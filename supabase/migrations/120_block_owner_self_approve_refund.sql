-- ============================================================================
-- 120_block_owner_self_approve_refund.sql
--
-- An owner could approve (or reject) a refund they themselves requested.
-- That breaks separation-of-duty for high-value refunds where the owner
-- approval gate is the only review. Force a different reviewer.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_refund(p_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Refund is not pending (status=%)', v_r.status;
  END IF;

  IF v_r.requested_by = v_caller THEN
    RAISE EXCEPTION 'Owner cannot self-approve their own refund request — get another owner or wait for manager-tier'
      USING errcode = '42501';
  END IF;

  IF v_r.approval_required = 'owner' THEN
    IF NOT public.is_owner() THEN
      RAISE EXCEPTION 'Only the owner can approve a refund of this size';
    END IF;
  ELSE
    IF NOT (public.is_owner() OR public.has_capability('manage_team'::user_capability)) THEN
      RAISE EXCEPTION 'Insufficient permission to approve refunds';
    END IF;
  END IF;

  UPDATE public.refunds
  SET status      = 'approved',
      approved_at = now(),
      approved_by = v_caller
  WHERE id = p_refund_id;

  PERFORM public.emit_notification(
    p_event_type          := 'refund.approved',
    p_title               := 'Refund ' || v_r.refund_number || ' approved',
    p_body                := 'A ' || v_r.kind || ' refund of '
                             || v_r.currency || ' '
                             || to_char(v_r.amount, 'FM999999990.00')
                             || ' was approved and is ready to be paid.',
    p_related_entity_type := 'refund',
    p_related_entity_id   := v_r.id,
    p_link                := '/garage/refunds/' || v_r.id::text,
    p_metadata            := jsonb_build_object(
                               'refund_number', v_r.refund_number,
                               'amount', v_r.amount,
                               'currency', v_r.currency
                             ),
    p_event_subject_user_id := v_r.requested_by,
    p_event_submitter_id    := v_caller
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reject_refund(p_refund_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Refund is not pending (status=%)', v_r.status;
  END IF;

  IF v_r.requested_by = v_caller THEN
    RAISE EXCEPTION 'Owner cannot self-approve their own refund request — get another owner or wait for manager-tier'
      USING errcode = '42501';
  END IF;

  IF v_r.approval_required = 'owner' THEN
    IF NOT public.is_owner() THEN
      RAISE EXCEPTION 'Only the owner can reject a refund of this size';
    END IF;
  ELSE
    IF NOT (public.is_owner() OR public.has_capability('manage_team'::user_capability)) THEN
      RAISE EXCEPTION 'Insufficient permission to reject refunds';
    END IF;
  END IF;

  UPDATE public.refunds
  SET status           = 'rejected',
      rejected_at      = now(),
      rejected_by      = v_caller,
      rejection_reason = p_reason
  WHERE id = p_refund_id;

  PERFORM public.emit_notification(
    p_event_type          := 'refund.rejected',
    p_title               := 'Refund ' || v_r.refund_number || ' rejected',
    p_body                := 'Reason: ' || p_reason,
    p_related_entity_type := 'refund',
    p_related_entity_id   := v_r.id,
    p_link                := '/garage/refunds/' || v_r.id::text,
    p_metadata            := jsonb_build_object('refund_number', v_r.refund_number),
    p_event_subject_user_id := v_r.requested_by,
    p_event_submitter_id    := v_caller
  );
END;
$fn$;
