-- Replaces the client-side daemon at web/src/app/(dashboard)/installments/page.tsx
-- (lines 167-303) with a server-side cron job. The daemon used to run on every
-- visit by every user, with no transaction and no notification dedup. Now it
-- runs once per day at 06:00 UTC under the postgres role, transactionally.

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.advance_installment_statuses()
RETURNS TABLE (newly_overdue int, newly_due int, plans_defaulted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  today_date         date := (now() at time zone 'UTC')::date;
  cutoff_default     date := today_date - interval '90 days';
  recipient_ids      uuid[];
  v_overdue_count    int := 0;
  v_due_count        int := 0;
  v_defaulted_count  int := 0;
BEGIN
  -- Recipients: active owners + assistants.
  SELECT array_agg(id)
    INTO recipient_ids
    FROM public.profiles
   WHERE user_role IN ('owner', 'assistant')
     AND is_active = true;

  -- 1) Move past-due installments still marked upcoming/due to overdue.
  WITH flipped AS (
    UPDATE public.installment_payments ip
       SET status = 'overdue', updated_at = now()
     WHERE ip.due_date < today_date
       AND ip.status IN ('upcoming','due')
    RETURNING ip.id, ip.installment_no, ip.amount_due, ip.due_date, ip.plan_id
  )
  SELECT count(*) INTO v_overdue_count FROM flipped;

  IF v_overdue_count > 0 AND recipient_ids IS NOT NULL AND array_length(recipient_ids, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, link, is_read)
    SELECT
      r,
      'Installment overdue',
      'OVERDUE: Installment #' || ip.installment_no
        || ' for ' || coalesce(c.first_name, '') ||
        case when c.last_name is not null and c.last_name <> '' then ' ' || c.last_name else '' end
        || ' (' || coalesce(car.model, '?') || ' / VIN ' || coalesce(car.vin, '?') || ')'
        || ' is ' || (today_date - ip.due_date) || ' days late'
        || ' — ' || coalesce(ip.amount_due::text, '0') || ' USD',
      '/installments',
      false
    FROM unnest(recipient_ids) AS r
    CROSS JOIN public.installment_payments ip
    LEFT JOIN public.payment_plans pp ON pp.id = ip.plan_id
    LEFT JOIN public.customers c      ON c.id  = pp.customer_id
    LEFT JOIN public.cars car         ON car.id = pp.car_id
    WHERE ip.status = 'overdue'
      AND ip.updated_at >= now() - interval '5 minutes'  -- only those just flipped
      AND ip.due_date < today_date;
  END IF;

  -- 2) Move installments whose due_date is today and status is upcoming -> due.
  WITH flipped AS (
    UPDATE public.installment_payments ip
       SET status = 'due', updated_at = now()
     WHERE ip.due_date = today_date
       AND ip.status = 'upcoming'
    RETURNING ip.id, ip.installment_no, ip.amount_due, ip.plan_id
  )
  SELECT count(*) INTO v_due_count FROM flipped;

  IF v_due_count > 0 AND recipient_ids IS NOT NULL AND array_length(recipient_ids, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, link, is_read)
    SELECT
      r,
      'Installment due today',
      'Installment #' || ip.installment_no
        || ' for ' || coalesce(c.first_name, '') ||
        case when c.last_name is not null and c.last_name <> '' then ' ' || c.last_name else '' end
        || ' (' || coalesce(car.model, '?') || ' / VIN ' || coalesce(car.vin, '?') || ')'
        || ' is due today — ' || coalesce(ip.amount_due::text, '0') || ' USD',
      '/installments',
      false
    FROM unnest(recipient_ids) AS r
    CROSS JOIN public.installment_payments ip
    LEFT JOIN public.payment_plans pp ON pp.id = ip.plan_id
    LEFT JOIN public.customers c      ON c.id  = pp.customer_id
    LEFT JOIN public.cars car         ON car.id = pp.car_id
    WHERE ip.status = 'due'
      AND ip.updated_at >= now() - interval '5 minutes'
      AND ip.due_date = today_date;
  END IF;

  -- 3) Mark payment_plans whose oldest overdue installment is older than 90 days
  --    as 'defaulted' (one-way; never auto-reset).
  WITH bad_plans AS (
    SELECT DISTINCT plan_id
      FROM public.installment_payments
     WHERE status = 'overdue'
       AND due_date < cutoff_default
  )
  UPDATE public.payment_plans pp
     SET status = 'defaulted', updated_at = now()
   FROM bad_plans bp
   WHERE pp.id = bp.plan_id
     AND pp.status IS DISTINCT FROM 'defaulted';

  GET DIAGNOSTICS v_defaulted_count = ROW_COUNT;

  RETURN QUERY SELECT v_overdue_count, v_due_count, v_defaulted_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.advance_installment_statuses() FROM authenticated, anon, PUBLIC;

-- Schedule daily at 06:00 UTC (late morning Beirut). Re-running unschedule
-- first makes the migration idempotent.
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id
    FROM cron.job
   WHERE jobname = 'advance-installment-statuses';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'advance-installment-statuses',
  '0 6 * * *',
  $$ SELECT public.advance_installment_statuses(); $$
);
