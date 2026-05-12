-- Phase B1: maintenance reminder loop (km + time-based service intervals).
--
-- Three pieces:
--   1. notification_event_rules for service.due_soon (warning) and
--      service.overdue (urgent). Recipients: service advisor on the
--      customer (event_subject_owner) + Lara + garage manager (overdue).
--   2. service_intervals table — recurring trigger definitions (every N km
--      OR every N months OR both). Seeded with oil change (5k), annual,
--      major (15k). Editable by owner / manage_team.
--   3. car_service_status view per (car, interval): last_service_*,
--      next_due_*, km_to_next, days_to_next, status (ok / due_soon / overdue).
--      Excludes sold + delivered cars.
--   4. detect_service_due() cron — daily 06:15 UTC. For each due_soon /
--      overdue (car, interval) tuple, emits the right notification once,
--      keyed off (car, interval, next_due_km, next_due_at, status) so the
--      same cycle never re-fires.
--      Tries to resolve the service advisor via sales_orders.created_by.

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('service.due_soon', 'Service is coming due soon',
     'alert', 'warning',
     'event_subject_owner', NULL, true, false, false,
     'Service advisor or whoever owns the customer relationship'),
  ('service.due_soon', 'Service is coming due soon',
     'alert', 'warning',
     'user', '80829aa7-378a-4cd1-8d0b-debde9dc510d', true, false, false,
     'Lara — customer-reach-out queue'),
  ('service.overdue', 'Service is overdue',
     'alert', 'urgent',
     'event_subject_owner', NULL, true, false, false,
     'Service advisor'),
  ('service.overdue', 'Service is overdue',
     'alert', 'urgent',
     'user', '80829aa7-378a-4cd1-8d0b-debde9dc510d', true, false, false,
     'Lara'),
  ('service.overdue', 'Service is overdue',
     'alert', 'urgent',
     'role', 'garage_manager', true, false, false,
     'Manager visibility')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.service_intervals (
  id              text PRIMARY KEY,
  label_en        text NOT NULL,
  description     text,
  interval_km     integer,
  interval_months integer,
  lead_km         integer NOT NULL DEFAULT 500,
  lead_days       integer NOT NULL DEFAULT 14,
  active          boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_intervals_at_least_one_dimension
    CHECK (interval_km IS NOT NULL OR interval_months IS NOT NULL)
);

ALTER TABLE public.service_intervals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_intervals_sel ON public.service_intervals;
CREATE POLICY service_intervals_sel ON public.service_intervals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS service_intervals_write ON public.service_intervals;
CREATE POLICY service_intervals_write ON public.service_intervals
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('manage_team'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('manage_team'::user_capability));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_intervals TO authenticated;

INSERT INTO public.service_intervals
  (id, label_en, description, interval_km, interval_months, lead_km, lead_days, sort_order)
VALUES
  ('oil_change_5k', 'Oil change',
     'Every 5,000 km. Lead reminder 500 km / 14 days early.',
     5000, NULL, 500, 14, 10),
  ('annual_service', 'Annual service',
     'Every 12 months regardless of km. Lead reminder 14 days early.',
     NULL, 12, 0, 14, 20),
  ('major_service_15k', 'Major service',
     'Every 15,000 km — full inspection, filters, brake fluid, plugs.',
     15000, NULL, 1000, 21, 30)
ON CONFLICT (id) DO UPDATE SET
  label_en = EXCLUDED.label_en,
  description = EXCLUDED.description,
  interval_km = EXCLUDED.interval_km,
  interval_months = EXCLUDED.interval_months,
  lead_km = EXCLUDED.lead_km,
  lead_days = EXCLUDED.lead_days,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE OR REPLACE VIEW public.car_service_status AS
WITH last_service AS (
  SELECT
    gj.car_id,
    max(gj.current_km)    FILTER (WHERE gj.current_km IS NOT NULL) AS last_service_km,
    max(gj.completed_at)  AS last_service_at
  FROM public.garage_jobs gj
  WHERE gj.status IN ('done', 'delivered')
    AND gj.deleted_at IS NULL
  GROUP BY gj.car_id
)
SELECT
  c.id                                            AS car_id,
  c.vin,
  c.brand,
  c.model,
  c.current_km,
  i.id                                            AS interval_id,
  i.label_en                                      AS interval_label,
  i.interval_km,
  i.interval_months,
  i.lead_km,
  i.lead_days,
  ls.last_service_km,
  ls.last_service_at,
  CASE
    WHEN i.interval_km IS NOT NULL
    THEN COALESCE(ls.last_service_km, 0) + i.interval_km
  END                                             AS next_due_km,
  CASE
    WHEN i.interval_months IS NOT NULL
    THEN COALESCE(ls.last_service_at, c.created_at) + (i.interval_months || ' months')::interval
  END                                             AS next_due_at,
  CASE
    WHEN i.interval_km IS NOT NULL AND c.current_km IS NOT NULL
    THEN (COALESCE(ls.last_service_km, 0) + i.interval_km) - c.current_km
  END                                             AS km_to_next,
  CASE
    WHEN i.interval_months IS NOT NULL
    THEN extract(epoch FROM
        (COALESCE(ls.last_service_at, c.created_at) + (i.interval_months || ' months')::interval) - now()
      ) / 86400.0
  END                                             AS days_to_next,
  CASE
    WHEN (i.interval_km IS NOT NULL AND c.current_km IS NOT NULL
          AND c.current_km > (COALESCE(ls.last_service_km, 0) + i.interval_km))
      OR (i.interval_months IS NOT NULL
          AND now() > (COALESCE(ls.last_service_at, c.created_at) + (i.interval_months || ' months')::interval))
    THEN 'overdue'
    WHEN (i.interval_km IS NOT NULL AND c.current_km IS NOT NULL
          AND c.current_km >= (COALESCE(ls.last_service_km, 0) + i.interval_km - i.lead_km))
      OR (i.interval_months IS NOT NULL
          AND now() >= (COALESCE(ls.last_service_at, c.created_at) + (i.interval_months || ' months')::interval - (i.lead_days || ' days')::interval))
    THEN 'due_soon'
    ELSE 'ok'
  END                                             AS status
FROM public.cars c
CROSS JOIN public.service_intervals i
LEFT JOIN last_service ls ON ls.car_id = c.id
WHERE c.deleted_at IS NULL
  AND c.status NOT IN ('sold'::car_status, 'delivered'::car_status)
  AND i.active = true;

GRANT SELECT ON public.car_service_status TO authenticated;

CREATE OR REPLACE FUNCTION public.detect_service_due()
RETURNS TABLE (due_soon_emitted int, overdue_emitted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_due int := 0;
  v_over int := 0;
  r record;
  v_n int;
  v_key text;
  v_subject uuid;
BEGIN
  FOR r IN
    SELECT s.* FROM public.car_service_status s
     WHERE s.status IN ('due_soon', 'overdue')
  LOOP
    v_key := r.car_id::text
      || '|' || r.interval_id
      || '|' || COALESCE(r.next_due_km::text, '_')
      || '|' || COALESCE(r.next_due_at::date::text, '_')
      || '|' || r.status;

    IF EXISTS (
      SELECT 1 FROM public.system_events e
       WHERE e.event_type = 'service.notif.emitted'
         AND (e.metadata ->> 'key') = v_key
    ) THEN CONTINUE; END IF;

    SELECT so.created_by INTO v_subject
      FROM public.sales_orders so
     WHERE so.car_id = r.car_id
       AND so.status IN ('delivered', 'paid', 'confirmed')
     ORDER BY so.delivered_at DESC NULLS LAST, so.created_at DESC
     LIMIT 1;

    v_n := COALESCE(public.emit_notification(
      CASE WHEN r.status = 'overdue' THEN 'service.overdue' ELSE 'service.due_soon' END,
      CASE WHEN r.status = 'overdue'
        THEN r.interval_label || ' overdue'
        ELSE r.interval_label || ' due soon'
      END,
      coalesce(r.brand,'') || ' ' || coalesce(r.model,'')
        || ' (VIN ' || right(coalesce(r.vin,''), 8) || '): '
        || CASE
             WHEN r.km_to_next IS NOT NULL AND r.km_to_next <= 0
               THEN 'over by ' || abs(r.km_to_next)::text || ' km. '
             WHEN r.km_to_next IS NOT NULL
               THEN r.km_to_next::text || ' km until due. '
             ELSE ''
           END
        || CASE
             WHEN r.days_to_next IS NOT NULL AND r.days_to_next <= 0
               THEN 'Was due ' || abs(r.days_to_next::int)::text || ' days ago.'
             WHEN r.days_to_next IS NOT NULL
               THEN 'Due in ' || r.days_to_next::int::text || ' days.'
             ELSE ''
           END,
      'car',
      r.car_id,
      '/cars/' || COALESCE(r.vin, r.car_id::text),
      jsonb_build_object(
        'car_id', r.car_id,
        'interval_id', r.interval_id,
        'next_due_km', r.next_due_km,
        'next_due_at', r.next_due_at,
        'km_to_next', r.km_to_next,
        'days_to_next', r.days_to_next
      ),
      v_subject,
      NULL
    ), 0);

    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES (
      'service.notif.emitted',
      CASE WHEN r.status = 'overdue' THEN 'urgent' ELSE 'warning' END,
      r.interval_label || ' (' || r.status || ') for ' || coalesce(r.vin,'?'),
      jsonb_build_object('key', v_key, 'car_id', r.car_id, 'recipients', v_n)
    );

    IF r.status = 'overdue' THEN v_over := v_over + 1;
    ELSE                          v_due  := v_due + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_due, v_over;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_service_due() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'detect-service-due';
  IF v_existing IS NOT NULL THEN PERFORM cron.unschedule(v_existing); END IF;
  PERFORM cron.schedule(
    'detect-service-due',
    '15 6 * * *',
    $cron$ SELECT public.detect_service_due(); $cron$
  );
END $$;
