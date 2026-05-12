-- Activate two pre-seeded notification rule families that until now had
-- no emitter:
--
--   test_drive.overdue_1h / overdue_3h  (rules from migration 087c)
--   warranty.expires_30d / 14d / 7d     (rules from migration 087c)
--
-- Both run via pg_cron, debounced via system_events so each row only
-- fires once per stage. Test-drive runs every 15 min (hour granularity);
-- warranty runs daily at 06:00 UTC.

-- ============================================================================
-- 1) detect_overdue_test_drives
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_overdue_test_drives()
RETURNS TABLE (overdue_1h_emitted int, overdue_3h_emitted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_1h int := 0;
  v_3h int := 0;
  r    record;
  v_n  int;
  v_h  int;
BEGIN
  FOR r IN
    SELECT
      td.id,
      td.car_id,
      td.vin,
      td.customer_name,
      td.employee_user_id,
      td.expected_return_at,
      EXTRACT(EPOCH FROM (now() - td.expected_return_at)) / 3600.0 AS hours_over
    FROM public.test_drives td
    WHERE td.status = 'out_for_test_drive'
      AND td.actual_return_at IS NULL
      AND td.expected_return_at IS NOT NULL
      AND td.expected_return_at < now() - interval '3 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.system_events e
         WHERE e.event_type = 'test_drive.overdue_3h.emitted'
           AND (e.metadata ->> 'test_drive_id')::uuid = td.id
      )
  LOOP
    v_h := r.hours_over::int;
    v_n := COALESCE(public.emit_notification(
      'test_drive.overdue_3h',
      'Test drive overdue > 3 hours — possible missing vehicle',
      'Customer ' || COALESCE(r.customer_name, '—')
        || ' was due back ' || v_h::text || 'h ago. VIN ' || COALESCE(r.vin, '—') || '.',
      'test_drive',
      r.id,
      '/test-drive',
      jsonb_build_object('test_drive_id', r.id, 'hours_overdue', v_h, 'car_id', r.car_id),
      r.employee_user_id,
      NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('test_drive.overdue_3h.emitted', 'urgent',
      'Test drive ' || r.id::text || ' overdue ' || v_h::text || 'h',
      jsonb_build_object('test_drive_id', r.id, 'recipients', v_n));
    v_3h := v_3h + 1;
  END LOOP;

  FOR r IN
    SELECT
      td.id,
      td.car_id,
      td.vin,
      td.customer_name,
      td.employee_user_id,
      td.expected_return_at,
      EXTRACT(EPOCH FROM (now() - td.expected_return_at)) / 3600.0 AS hours_over
    FROM public.test_drives td
    WHERE td.status = 'out_for_test_drive'
      AND td.actual_return_at IS NULL
      AND td.expected_return_at IS NOT NULL
      AND td.expected_return_at < now() - interval '1 hour'
      AND td.expected_return_at >= now() - interval '3 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.system_events e
         WHERE e.event_type = 'test_drive.overdue_1h.emitted'
           AND (e.metadata ->> 'test_drive_id')::uuid = td.id
      )
  LOOP
    v_h := r.hours_over::int;
    v_n := COALESCE(public.emit_notification(
      'test_drive.overdue_1h',
      'Test drive overdue > 1 hour',
      'Customer ' || COALESCE(r.customer_name, '—')
        || ' was due back ' || v_h::text || 'h ago. VIN ' || COALESCE(r.vin, '—') || '.',
      'test_drive',
      r.id,
      '/test-drive',
      jsonb_build_object('test_drive_id', r.id, 'hours_overdue', v_h, 'car_id', r.car_id),
      r.employee_user_id,
      NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('test_drive.overdue_1h.emitted', 'warning',
      'Test drive ' || r.id::text || ' overdue ' || v_h::text || 'h',
      jsonb_build_object('test_drive_id', r.id, 'recipients', v_n));
    v_1h := v_1h + 1;
  END LOOP;

  RETURN QUERY SELECT v_1h, v_3h;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_overdue_test_drives() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'detect-overdue-test-drives';
  IF v_existing IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing);
  END IF;
  PERFORM cron.schedule(
    'detect-overdue-test-drives',
    '*/15 * * * *',
    $cron$ SELECT public.detect_overdue_test_drives(); $cron$
  );
END $$;

-- ============================================================================
-- 2) detect_warranty_expiry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_warranty_expiry()
RETURNS TABLE (expires_30d_emitted int, expires_14d_emitted int, expires_7d_emitted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_30 int := 0;
  v_14 int := 0;
  v_7  int := 0;
  r    record;
  v_n  int;
  v_days int;
BEGIN
  FOR r IN
    SELECT c.id, c.vin, c.brand, c.model, c.warranty_expiry,
           (c.warranty_expiry - CURRENT_DATE)::int AS days_remaining
      FROM public.cars c
     WHERE c.deleted_at IS NULL
       AND c.warranty_expiry IS NOT NULL
       AND c.warranty_expiry > CURRENT_DATE
       AND c.warranty_expiry <= CURRENT_DATE + 7
       AND NOT EXISTS (
         SELECT 1 FROM public.system_events e
          WHERE e.event_type = 'warranty.expires_7d.emitted'
            AND (e.metadata ->> 'car_id')::uuid = c.id
       )
  LOOP
    v_days := r.days_remaining;
    v_n := COALESCE(public.emit_notification(
      'warranty.expires_7d',
      'Warranty expires in ' || v_days::text || ' days',
      coalesce(r.brand,'') || ' ' || coalesce(r.model,'')
        || ' (VIN ' || right(coalesce(r.vin,''), 8) || ') warranty expires ' || r.warranty_expiry::text,
      'car',
      r.id,
      '/cars/' || COALESCE(r.vin, r.id::text),
      jsonb_build_object('car_id', r.id, 'days_remaining', v_days, 'warranty_expiry', r.warranty_expiry),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('warranty.expires_7d.emitted', 'urgent',
      'Warranty 7d notif fired for car ' || r.id::text,
      jsonb_build_object('car_id', r.id, 'recipients', v_n));
    v_7 := v_7 + 1;
  END LOOP;

  FOR r IN
    SELECT c.id, c.vin, c.brand, c.model, c.warranty_expiry,
           (c.warranty_expiry - CURRENT_DATE)::int AS days_remaining
      FROM public.cars c
     WHERE c.deleted_at IS NULL
       AND c.warranty_expiry IS NOT NULL
       AND c.warranty_expiry > CURRENT_DATE + 7
       AND c.warranty_expiry <= CURRENT_DATE + 14
       AND NOT EXISTS (
         SELECT 1 FROM public.system_events e
          WHERE e.event_type = 'warranty.expires_14d.emitted'
            AND (e.metadata ->> 'car_id')::uuid = c.id
       )
  LOOP
    v_days := r.days_remaining;
    v_n := COALESCE(public.emit_notification(
      'warranty.expires_14d',
      'Warranty expires in ' || v_days::text || ' days',
      coalesce(r.brand,'') || ' ' || coalesce(r.model,'')
        || ' (VIN ' || right(coalesce(r.vin,''), 8) || ') warranty expires ' || r.warranty_expiry::text,
      'car',
      r.id,
      '/cars/' || COALESCE(r.vin, r.id::text),
      jsonb_build_object('car_id', r.id, 'days_remaining', v_days, 'warranty_expiry', r.warranty_expiry),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('warranty.expires_14d.emitted', 'warning',
      'Warranty 14d notif fired for car ' || r.id::text,
      jsonb_build_object('car_id', r.id, 'recipients', v_n));
    v_14 := v_14 + 1;
  END LOOP;

  FOR r IN
    SELECT c.id, c.vin, c.brand, c.model, c.warranty_expiry,
           (c.warranty_expiry - CURRENT_DATE)::int AS days_remaining
      FROM public.cars c
     WHERE c.deleted_at IS NULL
       AND c.warranty_expiry IS NOT NULL
       AND c.warranty_expiry > CURRENT_DATE + 14
       AND c.warranty_expiry <= CURRENT_DATE + 30
       AND NOT EXISTS (
         SELECT 1 FROM public.system_events e
          WHERE e.event_type = 'warranty.expires_30d.emitted'
            AND (e.metadata ->> 'car_id')::uuid = c.id
       )
  LOOP
    v_days := r.days_remaining;
    v_n := COALESCE(public.emit_notification(
      'warranty.expires_30d',
      'Warranty expires in ' || v_days::text || ' days',
      coalesce(r.brand,'') || ' ' || coalesce(r.model,'')
        || ' (VIN ' || right(coalesce(r.vin,''), 8) || ') warranty expires ' || r.warranty_expiry::text,
      'car',
      r.id,
      '/cars/' || COALESCE(r.vin, r.id::text),
      jsonb_build_object('car_id', r.id, 'days_remaining', v_days, 'warranty_expiry', r.warranty_expiry),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('warranty.expires_30d.emitted', 'info',
      'Warranty 30d notif fired for car ' || r.id::text,
      jsonb_build_object('car_id', r.id, 'recipients', v_n));
    v_30 := v_30 + 1;
  END LOOP;

  RETURN QUERY SELECT v_30, v_14, v_7;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_warranty_expiry() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'detect-warranty-expiry';
  IF v_existing IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing);
  END IF;
  PERFORM cron.schedule(
    'detect-warranty-expiry',
    '0 6 * * *',
    $cron$ SELECT public.detect_warranty_expiry(); $cron$
  );
END $$;
