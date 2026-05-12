-- Day 3 of the autopilot week:
--   1. Add notification rule for 'task.assigned' so each task fan-out
--      lands in the assignee's bell. Plus _urgent and _critical variants
--      that escalate severity and turn on email/whatsapp when channels
--      come online.
--   2. set_garage_job_category(p_job_id, p_category_id, p_current_km)
--      RPC: receiver picks one of the 13 reason-for-visit categories on
--      a stub job; we fan out tasks per task_routing_rules with SLA
--      clock baked into tasks.due_at; we notify the assignees via
--      emit_notification.
--   3. Stuck-job cron: daily 07:00 UTC, finds live garage_jobs whose
--      creation > 7d (warning) / > 14d (escalation) ago and emits
--      garage_job.stuck_7d / .stuck_14d. Debounced via system_events log
--      so each job only fires once per stage.
--
-- Two follow-on patches in 090b/090c/090d (folded into this file as the
-- canonical truth):
--   - tasks.priority is type job_priority, not task_priority.
--   - tasks.status CHECK allows {open,in_progress,blocked,done,cancelled};
--     use 'open' for newly-created tasks.
--   - tasks had a unique(source_type, source_id) that blocked fan-out.
--     Replaced with a partial unique on (source_type, source_id,
--     assigned_to_user_id) so each (job, assignee) pair is unique but
--     N tasks per source can co-exist.

-- ============================================================================
-- 0) tasks: widen the source uniqueness to include the assignee
-- ============================================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_type_source_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_assignee_uniq
  ON public.tasks (source_type, source_id, assigned_to_user_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND assigned_to_user_id IS NOT NULL;

-- ============================================================================
-- 1) task.assigned notification rules
-- ============================================================================

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('task.assigned', 'You have a new task',
     'assignment', 'info',
     'event_subject_owner', NULL,
     true, false, false,
     'The task assignee gets the in-app ping; no email until channel is wired'),
  ('task.assigned_urgent', 'You have an urgent task',
     'assignment', 'urgent',
     'event_subject_owner', NULL,
     true, true, false,
     'Urgent severity carries an email when channel is on'),
  ('task.assigned_critical', 'You have a CRITICAL task',
     'assignment', 'critical',
     'event_subject_owner', NULL,
     true, true, true,
     'Always email + whatsapp when channels are on; cannot be snoozed')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2) set_garage_job_category RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_garage_job_category(
  p_job_id      uuid,
  p_category_id text,
  p_current_km  integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller    uuid := auth.uid();
  v_job       public.garage_jobs;
  v_cat       public.task_categories;
  v_rule      public.task_routing_rules;
  v_due_at    timestamptz;
  v_severity  public.notification_severity;
  v_assignees uuid[];
  v_aid       uuid;
  v_task_id   uuid;
  v_emitted   integer := 0;
  v_tasks_made integer := 0;
  v_event_type text;
  v_title     text;
  v_body      text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (
    public.is_owner()
    OR public.has_capability('garage'::user_capability)
    OR public.has_capability('manage_team'::user_capability)
  ) THEN
    RAISE EXCEPTION 'Only owner / garage capability can set job category'
      USING errcode = '42501';
  END IF;

  SELECT * INTO v_job FROM public.garage_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'garage_job % not found', p_job_id USING errcode = '02000';
  END IF;
  IF v_job.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'job is deleted' USING errcode = '40000';
  END IF;

  SELECT * INTO v_cat FROM public.task_categories
   WHERE id = p_category_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_category % not found or inactive', p_category_id
      USING errcode = '02000';
  END IF;

  v_due_at   := now() + (v_cat.sla_hours::text || ' hours')::interval;
  v_severity := v_cat.default_severity;

  UPDATE public.garage_jobs
     SET task_category_id = p_category_id,
         current_km       = COALESCE(p_current_km, v_job.current_km),
         status           = CASE
                              WHEN v_job.status = 'pending' THEN 'in_progress'
                              ELSE v_job.status
                            END,
         started_at       = COALESCE(v_job.started_at, now()),
         due_date         = COALESCE(v_job.due_date, v_due_at::date),
         updated_at       = now()
   WHERE id = p_job_id;

  FOR v_rule IN
    SELECT * FROM public.task_routing_rules
     WHERE category_id = p_category_id AND active = true
     ORDER BY is_primary DESC, sort_order ASC
  LOOP
    v_assignees := CASE v_rule.assignee_kind
      WHEN 'user' THEN ARRAY[v_rule.assignee_value::uuid]
      WHEN 'role' THEN (
        SELECT array_agg(p.id) FROM public.profiles p
         WHERE p.is_active = true
           AND (
             p.user_role::text = v_rule.assignee_value
             OR (
               p.user_role = 'hybrid'
               AND (
                 (v_rule.assignee_value = 'garage_staff'
                   AND 'garage'::user_capability = ANY(p.capabilities))
                 OR (v_rule.assignee_value = 'garage_manager'
                   AND 'garage'::user_capability = ANY(p.capabilities)
                   AND 'manage_team'::user_capability = ANY(p.capabilities))
                 OR (v_rule.assignee_value = 'assistant'
                   AND ('cashier'::user_capability = ANY(p.capabilities)
                        OR 'data_health'::user_capability = ANY(p.capabilities)))
               )
             )
           )
      )
      WHEN 'capability' THEN (
        SELECT array_agg(p.id) FROM public.profiles p
         WHERE p.is_active = true
           AND v_rule.assignee_value::user_capability = ANY(
             COALESCE(p.capabilities, ARRAY[]::user_capability[])
           )
      )
    END;

    IF v_assignees IS NULL THEN CONTINUE; END IF;

    FOREACH v_aid IN ARRAY v_assignees LOOP
      INSERT INTO public.tasks (
        title,
        description,
        status,
        priority,
        assigned_to_user_id,
        source_type,
        source_id,
        due_at,
        created_by_user_id
      ) VALUES (
        v_cat.label_en
          || ' — '
          || COALESCE(NULLIF(v_job.title, ''), 'service intake'),
        COALESCE(v_rule.note, v_cat.description),
        'open',
        (CASE v_severity
          WHEN 'critical' THEN 'urgent'
          WHEN 'urgent'   THEN 'urgent'
          ELSE                 'normal'
        END)::public.job_priority,
        v_aid,
        'garage_job',
        p_job_id,
        v_due_at,
        v_caller
      ) RETURNING id INTO v_task_id;
      v_tasks_made := v_tasks_made + 1;

      v_event_type := CASE v_severity
        WHEN 'critical' THEN 'task.assigned_critical'
        WHEN 'urgent'   THEN 'task.assigned_urgent'
        ELSE                 'task.assigned'
      END;

      v_title := COALESCE(v_rule.role_label, 'New task') || ': ' || v_cat.label_en;
      v_body  := COALESCE(NULLIF(v_job.title, ''), 'Service intake')
        || ' · due ' || to_char(v_due_at AT TIME ZONE 'Asia/Beirut', 'YYYY-MM-DD HH24:MI');

      v_emitted := v_emitted + COALESCE(public.emit_notification(
        v_event_type,
        v_title,
        v_body,
        'garage_job',
        p_job_id,
        '/garage/jobs/' || p_job_id::text,
        jsonb_build_object(
          'task_id', v_task_id,
          'category_id', p_category_id,
          'is_parallel', v_rule.is_parallel,
          'sla_due_at', v_due_at
        ),
        v_aid,
        NULL
      ), 0);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'category_id', p_category_id,
    'tasks_created', v_tasks_made,
    'notifications_emitted', v_emitted,
    'sla_due_at', v_due_at
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_garage_job_category(uuid, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_garage_job_category(uuid, text, integer) TO authenticated;

-- ============================================================================
-- 3) Stuck-job cron
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_stuck_garage_jobs()
RETURNS TABLE (stuck_7d_emitted int, stuck_14d_emitted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_7d  int := 0;
  v_14d int := 0;
  r     record;
  v_n   int;
BEGIN
  FOR r IN
    SELECT gj.id, gj.title, gj.car_id, gj.created_at, gj.assigned_to
      FROM public.garage_jobs gj
     WHERE gj.deleted_at IS NULL
       AND gj.status IN ('pending', 'in_progress', 'waiting_parts', 'open')
       AND gj.created_at < now() - interval '14 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.system_events e
          WHERE e.event_type = 'garage_job.stuck_14d.emitted'
            AND (e.metadata ->> 'job_id')::uuid = gj.id
       )
  LOOP
    v_n := COALESCE(public.emit_notification(
      'garage_job.stuck_14d',
      'Garage job stuck > 14 days',
      COALESCE(r.title, 'Untitled job')
        || ' has been open for '
        || extract(day from now() - r.created_at)::int::text || ' days. Owner escalation.',
      'garage_job',
      r.id,
      '/garage/jobs/' || r.id::text,
      jsonb_build_object('job_id', r.id, 'days', extract(day from now() - r.created_at)::int),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('garage_job.stuck_14d.emitted', 'warning',
      'Stuck 14d notif fired for job ' || r.id::text,
      jsonb_build_object('job_id', r.id, 'recipients', v_n));
    v_14d := v_14d + 1;
  END LOOP;

  FOR r IN
    SELECT gj.id, gj.title, gj.car_id, gj.created_at
      FROM public.garage_jobs gj
     WHERE gj.deleted_at IS NULL
       AND gj.status IN ('pending', 'in_progress', 'waiting_parts', 'open')
       AND gj.created_at < now() - interval '7 days'
       AND gj.created_at >= now() - interval '14 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.system_events e
          WHERE e.event_type = 'garage_job.stuck_7d.emitted'
            AND (e.metadata ->> 'job_id')::uuid = gj.id
       )
  LOOP
    v_n := COALESCE(public.emit_notification(
      'garage_job.stuck_7d',
      'Garage job stuck > 7 days',
      COALESCE(r.title, 'Untitled job')
        || ' has been open for '
        || extract(day from now() - r.created_at)::int::text || ' days.',
      'garage_job',
      r.id,
      '/garage/jobs/' || r.id::text,
      jsonb_build_object('job_id', r.id, 'days', extract(day from now() - r.created_at)::int),
      NULL, NULL
    ), 0);
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES ('garage_job.stuck_7d.emitted', 'info',
      'Stuck 7d notif fired for job ' || r.id::text,
      jsonb_build_object('job_id', r.id, 'recipients', v_n));
    v_7d := v_7d + 1;
  END LOOP;

  RETURN QUERY SELECT v_7d, v_14d;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_stuck_garage_jobs() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'detect-stuck-garage-jobs';
  IF v_existing IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing);
  END IF;
  PERFORM cron.schedule(
    'detect-stuck-garage-jobs',
    '0 7 * * *',
    $cron$ SELECT public.detect_stuck_garage_jobs(); $cron$
  );
END $$;
