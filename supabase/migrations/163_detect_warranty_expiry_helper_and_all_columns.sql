-- ============================================================================
-- Rewrite detect_warranty_expiry() with a generic _emit_warranty_bucket helper
-- and monitor all 5 warranty date columns.
--
-- Live migration version: 20260526125825
-- Reconstructed for repo (this migration already exists on live DB).
--
-- Supersedes the intermediate live migration 20260526121200
-- (detect_warranty_expiry_add_dms), which only added warranty_per_dms.
-- This final form covers:
--   - warranty_expiry          (Warranty)
--   - warranty_per_dms         (DMS warranty)
--   - warranty_battery_dms     (DMS battery warranty)
--   - warranty_vehicle_expiry  (Vehicle warranty)
--   - warranty_battery_expiry  (Battery warranty)
--
-- Severity buckets: 0..7d urgent, 7..14d warning, 14..30d info.
-- ============================================================================

-- Helper: emit notifications + system_events for a single warranty column
-- and a single day-window.
CREATE OR REPLACE FUNCTION public._emit_warranty_bucket(
  p_column_name  text,
  p_event_prefix text,
  p_label        text,
  p_lower_days   integer,
  p_upper_days   integer,
  p_severity     text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int := 0;
  r record;
  v_n int;
  v_days int;
  v_event_emitted  text := p_event_prefix || '_' || p_upper_days::text || 'd.emitted';
  v_event_dispatch text := p_event_prefix || '_' || p_upper_days::text || 'd';
BEGIN
  FOR r IN EXECUTE format(
    $sql$
      SELECT c.id, c.vin, c.brand, c.model,
             c.%I AS warranty_date,
             (c.%I - CURRENT_DATE)::int AS days_remaining
        FROM public.cars c
       WHERE c.deleted_at IS NULL
         AND c.%I IS NOT NULL
         AND c.%I > CURRENT_DATE + $1
         AND c.%I <= CURRENT_DATE + $2
         AND NOT EXISTS (
           SELECT 1 FROM public.system_events e
            WHERE e.event_type = $3
              AND (e.metadata ->> 'car_id')::uuid = c.id
         )
    $sql$,
    p_column_name, p_column_name, p_column_name, p_column_name, p_column_name
  )
  USING p_lower_days, p_upper_days, v_event_emitted
  LOOP
    v_days := r.days_remaining;
    v_n := COALESCE(public.emit_notification(
      v_event_dispatch,
      p_label || ' expires in ' || v_days::text || ' days',
      coalesce(r.brand,'') || ' ' || coalesce(r.model,'')
        || ' (VIN ' || right(coalesce(r.vin,''), 8) || ') '
        || p_label || ' expires ' || r.warranty_date::text,
      'car',
      r.id,
      '/cars/' || COALESCE(r.vin, r.id::text),
      jsonb_build_object('car_id', r.id, 'days_remaining', v_days,
                         'warranty_column', p_column_name,
                         'warranty_date', r.warranty_date),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES (v_event_emitted, p_severity,
      p_label || ' ' || p_upper_days::text || 'd notif fired for car ' || r.id::text,
      jsonb_build_object('car_id', r.id, 'recipients', v_n,
                         'warranty_column', p_column_name));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._emit_warranty_bucket(text, text, text, integer, integer, text)
  FROM PUBLIC, anon, authenticated;

-- Replace detect_warranty_expiry() to iterate all 5 warranty columns x 3 buckets.
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
BEGIN
  -- 7-day buckets across all 5 warranty columns (urgent severity).
  v_7 := v_7 + public._emit_warranty_bucket('warranty_expiry',          'warranty.expires',                'Warranty',          0,  7,  'urgent');
  v_7 := v_7 + public._emit_warranty_bucket('warranty_per_dms',         'warranty.dms_expires',            'DMS warranty',      0,  7,  'urgent');
  v_7 := v_7 + public._emit_warranty_bucket('warranty_battery_dms',     'warranty.battery_dms_expires',    'DMS battery warranty', 0,  7,  'urgent');
  v_7 := v_7 + public._emit_warranty_bucket('warranty_vehicle_expiry',  'warranty.vehicle_expires',        'Vehicle warranty',  0,  7,  'urgent');
  v_7 := v_7 + public._emit_warranty_bucket('warranty_battery_expiry',  'warranty.battery_expires',        'Battery warranty',  0,  7,  'urgent');

  -- 14-day buckets (warning severity).
  v_14 := v_14 + public._emit_warranty_bucket('warranty_expiry',          'warranty.expires',                'Warranty',          7,  14, 'warning');
  v_14 := v_14 + public._emit_warranty_bucket('warranty_per_dms',         'warranty.dms_expires',            'DMS warranty',      7,  14, 'warning');
  v_14 := v_14 + public._emit_warranty_bucket('warranty_battery_dms',     'warranty.battery_dms_expires',    'DMS battery warranty', 7,  14, 'warning');
  v_14 := v_14 + public._emit_warranty_bucket('warranty_vehicle_expiry',  'warranty.vehicle_expires',        'Vehicle warranty',  7,  14, 'warning');
  v_14 := v_14 + public._emit_warranty_bucket('warranty_battery_expiry',  'warranty.battery_expires',        'Battery warranty',  7,  14, 'warning');

  -- 30-day buckets (info severity).
  v_30 := v_30 + public._emit_warranty_bucket('warranty_expiry',          'warranty.expires',                'Warranty',          14, 30, 'info');
  v_30 := v_30 + public._emit_warranty_bucket('warranty_per_dms',         'warranty.dms_expires',            'DMS warranty',      14, 30, 'info');
  v_30 := v_30 + public._emit_warranty_bucket('warranty_battery_dms',     'warranty.battery_dms_expires',    'DMS battery warranty', 14, 30, 'info');
  v_30 := v_30 + public._emit_warranty_bucket('warranty_vehicle_expiry',  'warranty.vehicle_expires',        'Vehicle warranty',  14, 30, 'info');
  v_30 := v_30 + public._emit_warranty_bucket('warranty_battery_expiry',  'warranty.battery_expires',        'Battery warranty',  14, 30, 'info');

  RETURN QUERY SELECT v_30, v_14, v_7;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_warranty_expiry() FROM PUBLIC, anon, authenticated;
