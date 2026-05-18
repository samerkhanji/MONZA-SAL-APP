-- ============================================================================
-- B7 RPCs — approval-gated refund flow + recall vehicle assignment
-- All RPCs are SECURITY DEFINER so the approval / status invariants
-- cannot be bypassed by raw table writes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_refund(
  p_kind            text,
  p_customer_id     uuid,
  p_amount          numeric,
  p_reason          text,
  p_currency        text DEFAULT 'USD',
  p_job_id          uuid DEFAULT NULL,
  p_invoice_id      uuid DEFAULT NULL,
  p_warranty_case_id uuid DEFAULT NULL,
  p_part_id         uuid DEFAULT NULL,
  p_quantity        integer DEFAULT NULL,
  p_notes           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_id       uuid;
  v_uid      uuid := auth.uid();
  v_approval text;
  v_number   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_owner()
       OR public.has_capability('garage'::user_capability)
       OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Insufficient permission to request refunds';
  END IF;

  IF p_kind NOT IN ('parts','service') THEN
    RAISE EXCEPTION 'Refund kind must be parts or service (got %)', p_kind;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than zero';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;
  IF p_kind = 'parts' AND p_part_id IS NULL THEN
    RAISE EXCEPTION 'part_id is required for a parts refund';
  END IF;

  v_approval := public.required_approver('refund', p_amount);
  v_number   := public.generate_refund_number();

  INSERT INTO public.refunds (
    refund_number, kind, customer_id, job_id, invoice_id,
    warranty_case_id, part_id, quantity,
    amount, currency, reason, notes,
    approval_required, status,
    requested_at, requested_by
  )
  VALUES (
    v_number, p_kind, p_customer_id, p_job_id, p_invoice_id,
    p_warranty_case_id, p_part_id, p_quantity,
    p_amount, COALESCE(p_currency, 'USD'), p_reason, p_notes,
    v_approval, 'pending',
    now(), v_uid
  )
  RETURNING id INTO v_id;

  PERFORM public.emit_notification(
    p_event_type           := CASE
                                WHEN v_approval = 'owner'   THEN 'refund.needs_owner_approval'
                                WHEN v_approval = 'manager' THEN 'refund.needs_manager_approval'
                                ELSE                              'refund.requested'
                              END,
    p_title                := 'Refund requested ' || v_number,
    p_body                 := 'A ' || p_kind || ' refund of '
                              || COALESCE(p_currency,'USD') || ' '
                              || to_char(p_amount, 'FM999999990.00')
                              || ' is awaiting ' || v_approval || ' review.',
    p_related_entity_type  := 'refund',
    p_related_entity_id    := v_id,
    p_link                 := '/garage/refunds/' || v_id::text,
    p_metadata             := jsonb_build_object(
                                'refund_number', v_number,
                                'kind', p_kind,
                                'amount', p_amount,
                                'currency', COALESCE(p_currency,'USD'),
                                'approval_required', v_approval
                              ),
    p_event_submitter_id   := v_uid
  );

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.request_refund(text, uuid, numeric, text, text, uuid, uuid, uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_refund(text, uuid, numeric, text, text, uuid, uuid, uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_refund(p_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Refund is not pending (status=%)', v_r.status;
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
      approved_by = v_uid
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
    p_event_submitter_id    := v_uid
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.approve_refund(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_refund(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_refund(p_refund_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Refund is not pending (status=%)', v_r.status;
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
      rejected_by      = v_uid,
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
    p_event_submitter_id    := v_uid
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.reject_refund(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_refund(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_refund_paid(
  p_refund_id uuid,
  p_method    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_method NOT IN ('cash','bank','credit','other') THEN
    RAISE EXCEPTION 'Invalid payment method (got %)', p_method;
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only the owner or cashier can mark a refund as paid';
  END IF;

  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'approved' THEN
    RAISE EXCEPTION 'Refund must be approved before it can be paid (status=%)', v_r.status;
  END IF;

  UPDATE public.refunds
  SET status         = 'paid',
      paid_at        = now(),
      paid_by        = v_uid,
      payment_method = p_method
  WHERE id = p_refund_id;

  PERFORM public.emit_notification(
    p_event_type          := 'refund.paid',
    p_title               := 'Refund ' || v_r.refund_number || ' paid',
    p_body                := v_r.currency || ' '
                              || to_char(v_r.amount, 'FM999999990.00')
                              || ' paid out via ' || p_method,
    p_related_entity_type := 'refund',
    p_related_entity_id   := v_r.id,
    p_link                := '/garage/refunds/' || v_r.id::text,
    p_metadata            := jsonb_build_object(
                               'refund_number', v_r.refund_number,
                               'method', p_method
                             ),
    p_event_subject_user_id := v_r.requested_by,
    p_event_submitter_id    := v_uid
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.mark_refund_paid(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_refund_paid(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_refund(p_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_r public.refunds;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending refunds can be cancelled (status=%)', v_r.status;
  END IF;
  IF NOT (public.is_owner() OR v_r.requested_by = v_uid) THEN
    RAISE EXCEPTION 'Only the requester or the owner can cancel a refund';
  END IF;
  UPDATE public.refunds SET status='cancelled' WHERE id=p_refund_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.cancel_refund(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_refund(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_recall_vehicles(
  p_recall_id uuid,
  p_car_ids   uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF NOT (public.is_owner() OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Insufficient permission to assign vehicles to a recall';
  END IF;

  WITH ins AS (
    INSERT INTO public.recall_vehicles (recall_id, car_id, status)
    SELECT p_recall_id, c.id, 'pending'
    FROM unnest(p_car_ids) AS x(id)
    JOIN public.cars c ON c.id = x.id
    ON CONFLICT (recall_id, car_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.assign_recall_vehicles(uuid, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.assign_recall_vehicles(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_recall_vehicle(
  p_recall_vehicle_id uuid,
  p_status            text,
  p_job_id            uuid DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_owner() OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Insufficient permission';
  END IF;
  IF p_status NOT IN ('pending','customer_notified','scheduled','in_progress','completed','not_applicable','customer_refused') THEN
    RAISE EXCEPTION 'Invalid recall vehicle status: %', p_status;
  END IF;

  UPDATE public.recall_vehicles
  SET status        = p_status,
      job_id        = COALESCE(p_job_id, job_id),
      notes         = COALESCE(p_notes, notes),
      notified_at   = CASE WHEN p_status='customer_notified' AND notified_at IS NULL THEN now() ELSE notified_at END,
      scheduled_at  = CASE WHEN p_status='scheduled'         AND scheduled_at IS NULL THEN now() ELSE scheduled_at END,
      completed_at  = CASE WHEN p_status='completed' THEN now() ELSE completed_at END,
      completed_by  = CASE WHEN p_status='completed' THEN v_uid ELSE completed_by END
  WHERE id = p_recall_vehicle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recall vehicle row not found';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.mark_recall_vehicle(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_recall_vehicle(uuid, text, uuid, text) TO authenticated;

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('refund.needs_owner_approval',
   'Refund amount above owner threshold needs owner sign-off',
   'approval', 'urgent',
   'role', 'owner', true, false, false,
   'Owner sees the refund in the bell and approval list'),
  ('refund.needs_manager_approval',
   'Refund amount above manager threshold',
   'approval', 'warning',
   'capability', 'manage_team', true, false, false,
   'Manager/assistant approves these refunds'),
  ('refund.requested',
   'Refund requested below manager threshold (FYI only)',
   'alert', 'info',
   'role', 'owner', true, false, false,
   'Owner gets an FYI even for auto-band refunds'),
  ('refund.approved',
   'Refund was approved and is ready for payment',
   'status_change', 'warning',
   'capability', 'cashier', true, false, false,
   'Cashier needs to pay this out'),
  ('refund.rejected',
   'Refund was rejected',
   'status_change', 'warning',
   'event_submitter', null, true, false, false,
   'Original requester is informed'),
  ('refund.paid',
   'Refund was paid',
   'status_change', 'info',
   'event_submitter', null, true, false, false,
   'Original requester is informed')
ON CONFLICT DO NOTHING;
