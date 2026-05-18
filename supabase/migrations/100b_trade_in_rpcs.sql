-- ============================================================================
-- B4 RPCs — trade-in state machine
--   request_trade_in (sales)            → provisional
--   start_trade_in_inspection (garage)  → inspecting
--   complete_trade_in_inspection (garage) → inspected
--   approve_trade_in (owner)            → approved
--   reject_trade_in (owner)             → rejected
--   cancel_trade_in (sales/owner)       → cancelled
--   commit_trade_in_to_sale (owner)     → committed + linked to sales_order
--
-- All RPCs are SECURITY DEFINER. Direct UPDATE on trade_ins is owner-only
-- via RLS, so non-owners must use these RPCs and cannot bypass the gates.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_trade_in(
  p_customer_id        uuid,
  p_vehicle_make       text,
  p_vehicle_model      text,
  p_provisional_value  numeric,
  p_currency           text DEFAULT 'USD',
  p_vehicle_year       integer DEFAULT NULL,
  p_vehicle_vin        text    DEFAULT NULL,
  p_vehicle_plate      text    DEFAULT NULL,
  p_vehicle_color      text    DEFAULT NULL,
  p_vehicle_trim       text    DEFAULT NULL,
  p_mileage_km         integer DEFAULT NULL,
  p_notes              text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_id     uuid;
  v_number text;
  v_uid    uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_owner() OR public.has_capability('sales'::user_capability)) THEN
    RAISE EXCEPTION 'Only sales can request a trade-in';
  END IF;
  IF p_provisional_value IS NULL OR p_provisional_value < 0 THEN
    RAISE EXCEPTION 'Provisional value must be >= 0';
  END IF;
  IF p_vehicle_make IS NULL OR length(trim(p_vehicle_make)) = 0 THEN
    RAISE EXCEPTION 'Vehicle make is required';
  END IF;
  IF p_vehicle_model IS NULL OR length(trim(p_vehicle_model)) = 0 THEN
    RAISE EXCEPTION 'Vehicle model is required';
  END IF;

  v_number := public.generate_trade_in_number();

  INSERT INTO public.trade_ins (
    trade_in_number, customer_id,
    vehicle_make, vehicle_model, vehicle_year,
    vehicle_vin, vehicle_plate, vehicle_color, vehicle_trim,
    mileage_km, currency,
    provisional_value, status,
    inspection_notes,
    created_by
  )
  VALUES (
    v_number, p_customer_id,
    p_vehicle_make, p_vehicle_model, p_vehicle_year,
    p_vehicle_vin, p_vehicle_plate, p_vehicle_color, p_vehicle_trim,
    p_mileage_km, COALESCE(p_currency,'USD'),
    p_provisional_value, 'provisional',
    p_notes,
    v_uid
  )
  RETURNING id INTO v_id;

  PERFORM public.emit_notification(
    p_event_type           := 'trade_in.requested',
    p_title                := 'Trade-in requested ' || v_number,
    p_body                 := p_vehicle_make || ' ' || p_vehicle_model
                              || COALESCE(' (' || p_vehicle_year::text || ')', '')
                              || ' provisional ' || COALESCE(p_currency,'USD') || ' '
                              || to_char(p_provisional_value, 'FM999999990.00'),
    p_related_entity_type  := 'trade_in',
    p_related_entity_id    := v_id,
    p_link                 := '/trade-ins/' || v_id::text,
    p_metadata             := jsonb_build_object(
                                'trade_in_number', v_number,
                                'provisional_value', p_provisional_value,
                                'currency', COALESCE(p_currency,'USD')
                              ),
    p_event_submitter_id   := v_uid
  );

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.request_trade_in(uuid, text, text, numeric, text, integer, text, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_trade_in(uuid, text, text, numeric, text, integer, text, text, text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_trade_in_inspection(p_trade_in_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_owner() OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Only garage can start an inspection';
  END IF;
  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status <> 'provisional' THEN
    RAISE EXCEPTION 'Inspection can only start from provisional (status=%)', v_t.status;
  END IF;
  UPDATE public.trade_ins
    SET status                = 'inspecting',
        inspection_started_by = v_uid,
        inspection_started_at = now()
   WHERE id = p_trade_in_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.start_trade_in_inspection(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.start_trade_in_inspection(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_trade_in_inspection(
  p_trade_in_id           uuid,
  p_condition             text,
  p_recommended_value     numeric,
  p_mileage_km            integer DEFAULT NULL,
  p_estimated_repair_cost numeric DEFAULT NULL,
  p_inspection_notes      text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_owner() OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Only garage can complete an inspection';
  END IF;
  IF p_condition NOT IN ('excellent','good','fair','poor','salvage') THEN
    RAISE EXCEPTION 'Invalid condition: %', p_condition;
  END IF;
  IF p_recommended_value IS NULL OR p_recommended_value < 0 THEN
    RAISE EXCEPTION 'Recommended value is required and must be >= 0';
  END IF;

  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status NOT IN ('provisional','inspecting') THEN
    RAISE EXCEPTION 'Inspection can only be completed from provisional or inspecting (status=%)', v_t.status;
  END IF;

  UPDATE public.trade_ins
    SET status                = 'inspected',
        condition             = p_condition,
        recommended_value     = p_recommended_value,
        mileage_km            = COALESCE(p_mileage_km, mileage_km),
        estimated_repair_cost = COALESCE(p_estimated_repair_cost, estimated_repair_cost),
        inspection_notes      = COALESCE(p_inspection_notes, inspection_notes),
        inspected_by          = v_uid,
        inspected_at          = now(),
        inspection_started_by = COALESCE(inspection_started_by, v_uid),
        inspection_started_at = COALESCE(inspection_started_at, now())
   WHERE id = p_trade_in_id;

  PERFORM public.emit_notification(
    p_event_type           := 'trade_in.inspected',
    p_title                := 'Trade-in ' || v_t.trade_in_number || ' inspected',
    p_body                 := 'Recommended value ' || v_t.currency || ' '
                              || to_char(p_recommended_value, 'FM999999990.00')
                              || '. Owner approval required before this trade-in can affect a sale.',
    p_related_entity_type  := 'trade_in',
    p_related_entity_id    := p_trade_in_id,
    p_link                 := '/trade-ins/' || p_trade_in_id::text,
    p_metadata             := jsonb_build_object(
                                'trade_in_number', v_t.trade_in_number,
                                'recommended_value', p_recommended_value,
                                'currency', v_t.currency
                              ),
    p_event_subject_user_id := v_t.created_by,
    p_event_submitter_id    := v_uid
  );
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.complete_trade_in_inspection(uuid, text, numeric, integer, numeric, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.complete_trade_in_inspection(uuid, text, numeric, integer, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_trade_in(
  p_trade_in_id   uuid,
  p_accepted_value numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can approve a trade-in';
  END IF;
  IF p_accepted_value IS NULL OR p_accepted_value < 0 THEN
    RAISE EXCEPTION 'Accepted value is required and must be >= 0';
  END IF;

  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status <> 'inspected' THEN
    RAISE EXCEPTION 'Trade-in must be inspected before owner approval (status=%)', v_t.status;
  END IF;

  UPDATE public.trade_ins
    SET status         = 'approved',
        accepted_value = p_accepted_value,
        approved_by    = v_uid,
        approved_at    = now()
   WHERE id = p_trade_in_id;

  PERFORM public.emit_notification(
    p_event_type           := 'trade_in.approved',
    p_title                := 'Trade-in ' || v_t.trade_in_number || ' approved',
    p_body                 := 'Accepted value ' || v_t.currency || ' '
                              || to_char(p_accepted_value, 'FM999999990.00'),
    p_related_entity_type  := 'trade_in',
    p_related_entity_id    := p_trade_in_id,
    p_link                 := '/trade-ins/' || p_trade_in_id::text,
    p_metadata             := jsonb_build_object(
                                'trade_in_number', v_t.trade_in_number,
                                'accepted_value', p_accepted_value,
                                'currency', v_t.currency
                              ),
    p_event_subject_user_id := v_t.created_by,
    p_event_submitter_id    := v_uid
  );
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.approve_trade_in(uuid, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_trade_in(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_trade_in(
  p_trade_in_id uuid,
  p_reason      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can reject a trade-in';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status NOT IN ('inspected','provisional','inspecting') THEN
    RAISE EXCEPTION 'Trade-in cannot be rejected from status %', v_t.status;
  END IF;

  UPDATE public.trade_ins
    SET status           = 'rejected',
        rejected_by      = v_uid,
        rejected_at      = now(),
        rejection_reason = p_reason
   WHERE id = p_trade_in_id;

  PERFORM public.emit_notification(
    p_event_type           := 'trade_in.rejected',
    p_title                := 'Trade-in ' || v_t.trade_in_number || ' rejected',
    p_body                 := 'Reason: ' || p_reason,
    p_related_entity_type  := 'trade_in',
    p_related_entity_id    := p_trade_in_id,
    p_link                 := '/trade-ins/' || p_trade_in_id::text,
    p_metadata             := jsonb_build_object('trade_in_number', v_t.trade_in_number),
    p_event_subject_user_id := v_t.created_by,
    p_event_submitter_id    := v_uid
  );
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.reject_trade_in(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_trade_in(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_trade_in(
  p_trade_in_id uuid,
  p_reason      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status IN ('committed','rejected','cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a trade-in in status %', v_t.status;
  END IF;
  IF NOT (
    public.is_owner()
    OR (v_t.created_by = v_uid AND public.has_capability('sales'::user_capability))
  ) THEN
    RAISE EXCEPTION 'Only the requester or the owner can cancel a trade-in';
  END IF;

  UPDATE public.trade_ins
    SET status              = 'cancelled',
        cancelled_by        = v_uid,
        cancelled_at        = now(),
        cancellation_reason = p_reason
   WHERE id = p_trade_in_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.cancel_trade_in(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_trade_in(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.commit_trade_in_to_sale(
  p_trade_in_id    uuid,
  p_sales_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_t public.trade_ins;
  v_so public.sales_orders;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_owner() OR public.has_capability('sales'::user_capability)) THEN
    RAISE EXCEPTION 'Only sales or the owner can commit a trade-in to a sale';
  END IF;

  SELECT * INTO v_t FROM public.trade_ins WHERE id = p_trade_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade-in not found'; END IF;
  IF v_t.status <> 'approved' THEN
    RAISE EXCEPTION 'Trade-in is not approved (status=%) — cannot commit', v_t.status;
  END IF;
  IF v_t.accepted_value IS NULL THEN
    RAISE EXCEPTION 'Trade-in has no accepted_value';
  END IF;

  SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sales order not found'; END IF;

  UPDATE public.trade_ins
    SET status                = 'committed',
        linked_sales_order_id = p_sales_order_id,
        committed_at          = now(),
        committed_by          = v_uid
   WHERE id = p_trade_in_id;

  PERFORM public.emit_notification(
    p_event_type           := 'trade_in.committed',
    p_title                := 'Trade-in ' || v_t.trade_in_number || ' committed to sale',
    p_body                 := v_t.currency || ' '
                              || to_char(v_t.accepted_value, 'FM999999990.00')
                              || ' applied as trade-in credit on the sale.',
    p_related_entity_type  := 'trade_in',
    p_related_entity_id    := p_trade_in_id,
    p_link                 := '/trade-ins/' || p_trade_in_id::text,
    p_metadata             := jsonb_build_object(
                                'trade_in_number', v_t.trade_in_number,
                                'sales_order_id', p_sales_order_id,
                                'accepted_value', v_t.accepted_value,
                                'currency', v_t.currency
                              ),
    p_event_submitter_id   := v_uid
  );
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.commit_trade_in_to_sale(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.commit_trade_in_to_sale(uuid, uuid) TO authenticated;

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('trade_in.requested',
   'Sales has requested a trade-in. Garage needs to inspect.',
   'assignment', 'warning',
   'capability', 'garage', true, false, false,
   'Garage takes the next step (inspection)'),
  ('trade_in.requested',
   'Sales has requested a trade-in. Garage needs to inspect.',
   'assignment', 'info',
   'role', 'owner', true, false, false,
   'Owner FYI'),
  ('trade_in.inspected',
   'Inspection complete. Owner approval needed before the trade-in can affect a sale.',
   'approval', 'urgent',
   'role', 'owner', true, false, false,
   'Owner approves or rejects the recommended value'),
  ('trade_in.approved',
   'Owner has approved the trade-in. Sales can now commit it to a sales order.',
   'status_change', 'warning',
   'event_submitter', null, true, false, false,
   'Sales — original requester is notified'),
  ('trade_in.rejected',
   'Owner has rejected the trade-in.',
   'status_change', 'warning',
   'event_submitter', null, true, false, false,
   'Sales — original requester is notified'),
  ('trade_in.committed',
   'Trade-in committed to a sales order.',
   'status_change', 'info',
   'role', 'owner', true, false, false,
   'Owner FYI')
ON CONFLICT DO NOTHING;
