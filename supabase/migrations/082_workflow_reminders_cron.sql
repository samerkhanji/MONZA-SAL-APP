-- Wave 5 of the deep audit: workflow reminders + abandoned-request auto-close.
--
-- M5: a repair_proposal can sit in 'sent_to_customer' indefinitely. The
--     assistant who sent it has no built-in way to know "this proposal has
--     been waiting on a customer for two weeks." Send a daily reminder to
--     all active assistants for any proposal that's been waiting >7 days,
--     debounced to once per 3 days per proposal.
--
-- M7: a request in 'needs_more_info' rots forever if the submitter never
--     resubmits. Send the submitter a reminder after 7 days of inactivity,
--     debounced to once per 7 days per request. After 30 days of total
--     inactivity, auto-decline the request and notify the submitter.
--
-- All work runs server-side via pg_cron at 06:30 UTC daily. Idempotent:
--     re-running the migration replaces the function and reschedules the job.

-- ============================================================================
-- Schema additions: per-row "last reminded" timestamps for debouncing.
-- ============================================================================

ALTER TABLE public.repair_proposals
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ============================================================================
-- send_workflow_reminders(): the cron payload.
-- Returns counts so the system_events log (or future Sentry hook) can audit.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_workflow_reminders()
RETURNS TABLE (
  stale_proposals_reminded integer,
  abandoned_requests_reminded integer,
  abandoned_requests_closed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_assistant_ids uuid[];
  v_proposals_count int := 0;
  v_requests_reminded int := 0;
  v_requests_closed int := 0;
BEGIN
  -- M5: stale repair proposals -> nudge every active assistant.
  SELECT array_agg(id) INTO v_assistant_ids
    FROM public.profiles
   WHERE user_role = 'assistant' AND is_active = true;

  IF v_assistant_ids IS NOT NULL AND array_length(v_assistant_ids, 1) > 0 THEN
    WITH stale AS (
      SELECT rp.id, rp.job_id, rp.updated_at
        FROM public.repair_proposals rp
       WHERE rp.status = 'sent_to_customer'
         AND rp.updated_at < now() - interval '7 days'
         AND (rp.reminder_sent_at IS NULL OR rp.reminder_sent_at < now() - interval '3 days')
    ),
    inserted AS (
      INSERT INTO public.notifications (user_id, title, message, link, is_read)
      SELECT
        r,
        'Repair proposal still awaiting customer response',
        'A repair proposal has been with the customer for '
          || ((extract(day from now() - s.updated_at))::int)::text || ' days. Consider following up.',
        '/garage/jobs/' || s.job_id::text,
        false
      FROM unnest(v_assistant_ids) AS r
      CROSS JOIN stale s
      RETURNING 1
    )
    SELECT count(*) FROM inserted INTO v_proposals_count;

    -- count is per-assistant fan-out; report distinct proposals.
    IF v_proposals_count > 0 THEN
      v_proposals_count := v_proposals_count / GREATEST(array_length(v_assistant_ids, 1), 1);
    END IF;

    UPDATE public.repair_proposals
       SET reminder_sent_at = now()
     WHERE status = 'sent_to_customer'
       AND updated_at < now() - interval '7 days'
       AND (reminder_sent_at IS NULL OR reminder_sent_at < now() - interval '3 days');
  END IF;

  -- M7 nudge: needs_more_info requests >7d but <30d.
  WITH nudge AS (
    SELECT r.id, r.subject, r.submitted_by, r.updated_at
      FROM public.requests r
     WHERE r.status = 'needs_more_info'
       AND r.updated_at < now() - interval '7 days'
       AND r.updated_at > now() - interval '30 days'
       AND (r.reminder_sent_at IS NULL OR r.reminder_sent_at < now() - interval '7 days')
       AND r.submitted_by IS NOT NULL
  ),
  nudge_inserted AS (
    INSERT INTO public.notifications (user_id, title, message, link, is_read)
    SELECT
      n.submitted_by,
      'Reminder: more information requested',
      'Management asked for more info on "' || n.subject || '" '
        || ((extract(day from now() - n.updated_at))::int)::text
        || ' days ago. Please add the requested details and resubmit.',
      '/requests',
      false
    FROM nudge n
    RETURNING 1
  )
  SELECT count(*) FROM nudge_inserted INTO v_requests_reminded;

  UPDATE public.requests
     SET reminder_sent_at = now()
   WHERE status = 'needs_more_info'
     AND updated_at < now() - interval '7 days'
     AND updated_at > now() - interval '30 days'
     AND (reminder_sent_at IS NULL OR reminder_sent_at < now() - interval '7 days');

  -- M7 auto-close: needs_more_info >30d -> declined + notify + audit.
  -- Per Postgres docs, data-modifying CTEs in a single statement always
  -- run, even if the main SELECT references only one of them.
  WITH closed AS (
    UPDATE public.requests
       SET status = 'declined',
           management_comments = COALESCE(management_comments, '')
             || E'\n\n[Auto-closed by system after 30 days without resubmission.]',
           updated_at = now()
     WHERE status = 'needs_more_info'
       AND updated_at < now() - interval '30 days'
    RETURNING id, submitted_by, subject
  ),
  notif_ins AS (
    INSERT INTO public.notifications (user_id, title, message, link, is_read)
    SELECT
      c.submitted_by,
      'Request auto-closed',
      '"' || c.subject || '" was auto-closed because no information was added for 30 days. '
        || 'Open a new request if you still need help.',
      '/requests',
      false
    FROM closed c
    WHERE c.submitted_by IS NOT NULL
    RETURNING 1
  ),
  audit_ins AS (
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    SELECT
      'request.auto_closed_abandoned',
      'info',
      'Request "' || c.subject || '" auto-closed (30d in needs_more_info)',
      jsonb_build_object('request_id', c.id, 'submitted_by', c.submitted_by)
    FROM closed c
    RETURNING 1
  )
  SELECT count(*) FROM closed INTO v_requests_closed;

  RETURN QUERY SELECT v_proposals_count, v_requests_reminded, v_requests_closed;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_workflow_reminders() FROM PUBLIC, anon, authenticated;
-- Only the cron job (running as postgres) needs to call this.

-- ============================================================================
-- pg_cron schedule: 06:30 UTC daily. Replaces any prior schedule under
-- the same name (idempotent re-apply).
-- ============================================================================

DO $$
DECLARE
  v_existing_jobid bigint;
BEGIN
  SELECT jobid INTO v_existing_jobid FROM cron.job WHERE jobname = 'send-workflow-reminders';
  IF v_existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_jobid);
  END IF;
  PERFORM cron.schedule(
    'send-workflow-reminders',
    '30 6 * * *',
    $cron$ SELECT public.send_workflow_reminders(); $cron$
  );
END
$$;
