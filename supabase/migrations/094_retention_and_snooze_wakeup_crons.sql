-- Phase A foundations:
--   1. system_events retention — archive/delete rows older than 90 days
--      so the audit table doesn't grow unbounded. Keeps .emitted debounce
--      markers indefinitely (they prevent double-firing crons).
--   2. Snooze wake-up — when a notification's snoozed_until passes, clear
--      it so the row reappears in the bell + inbox. Realtime then republishes
--      via the existing trigger flow.

CREATE OR REPLACE FUNCTION public.purge_old_system_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM public.system_events
     WHERE created_at < now() - interval '90 days'
       AND event_type NOT LIKE '%.emitted'
    RETURNING 1
  )
  SELECT count(*) FROM d INTO v_deleted;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_old_system_events()
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'purge-old-system-events';
  IF v_existing IS NOT NULL THEN PERFORM cron.unschedule(v_existing); END IF;
  PERFORM cron.schedule(
    'purge-old-system-events',
    '0 3 * * 0',
    $cron$ SELECT public.purge_old_system_events(); $cron$
  );
END $$;

CREATE OR REPLACE FUNCTION public.wake_snoozed_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_woken int;
BEGIN
  WITH w AS (
    UPDATE public.notifications
       SET snoozed_until = NULL
     WHERE snoozed_until IS NOT NULL
       AND snoozed_until <= now()
       AND dismissed_at IS NULL
    RETURNING 1
  )
  SELECT count(*) FROM w INTO v_woken;
  RETURN v_woken;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.wake_snoozed_notifications()
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'wake-snoozed-notifications';
  IF v_existing IS NOT NULL THEN PERFORM cron.unschedule(v_existing); END IF;
  PERFORM cron.schedule(
    'wake-snoozed-notifications',
    '*/5 * * * *',
    $cron$ SELECT public.wake_snoozed_notifications(); $cron$
  );
END $$;
