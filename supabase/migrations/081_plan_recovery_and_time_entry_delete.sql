-- Wave 4 of the deep audit:
--
-- H13: defaulted payment plans had no recovery path. The cron at 06:00 UTC
--      flips a plan to 'defaulted' when an installment is >90 days overdue
--      (migration 074), but there was no UI button to reverse it. Provide
--      an owner-only RPC.
--
-- B2:  time entries (job_time_entries) had no delete path. A tech who
--      clocked into the wrong job had no way to fix it. Provide an RPC
--      that lets the entry's own user (or a garage manager) delete a
--      single entry. The existing recompute_job_actual_hours trigger
--      updates actual_hours after the delete.

-- ============================================================================
-- H13: recover_payment_plan_from_default
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recover_payment_plan_from_default(
  p_plan_id uuid,
  p_reason text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_plan public.payment_plans;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can recover a defaulted plan' USING errcode = '42501';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required (link to renegotiation, partial payment, etc.)' USING errcode = '23514';
  END IF;

  SELECT * INTO v_plan FROM public.payment_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_plan % not found', p_plan_id USING errcode = '02000';
  END IF;
  IF v_plan.status <> 'defaulted' THEN
    RAISE EXCEPTION 'Plan status is %, not defaulted', v_plan.status USING errcode = '40000';
  END IF;

  UPDATE public.payment_plans
     SET status     = 'active',
         updated_at = now()
   WHERE id = p_plan_id;

  -- Audit trail
  INSERT INTO public.system_events (event_type, severity, message, metadata)
  VALUES (
    'payment_plan.recovered_from_default',
    'warning',
    'Payment plan ' || p_plan_id::text || ' recovered from default',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'actor', v_caller,
      'reason', p_reason
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recover_payment_plan_from_default(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recover_payment_plan_from_default(uuid, text) TO authenticated;

-- ============================================================================
-- B2: delete_job_time_entry
-- A tech can delete their own entry; an owner or someone with manage_team
-- can delete any. The existing recompute trigger updates actual_hours.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_job_time_entry(p_entry_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_entry  public.job_time_entries;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  SELECT * INTO v_entry FROM public.job_time_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'time entry % not found', p_entry_id USING errcode = '02000';
  END IF;

  -- Only the owning user, an owner, or someone with manage_team capability
  -- can delete. Closes "wrong clock-in stays forever" from the audit.
  IF v_entry.user_id <> v_caller
     AND NOT public.is_owner()
     AND NOT public.has_capability('manage_team'::user_capability) THEN
    RAISE EXCEPTION 'Only the entry''s author, an owner, or a team manager can delete it'
      USING errcode = '42501';
  END IF;

  DELETE FROM public.job_time_entries WHERE id = p_entry_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_job_time_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_job_time_entry(uuid) TO authenticated;
