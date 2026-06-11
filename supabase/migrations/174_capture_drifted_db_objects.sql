-- ============================================
-- Monza S.A.L. — Capture drifted DB objects into version control (2026-06-11)
--
-- The audit found these objects existed only in the live database (created
-- via the dashboard) with no migration. They are dumped here verbatim via
-- pg_get_functiondef so a fresh re-provision from migrations recreates them.
-- CREATE OR REPLACE preserves existing grants on the live DB; the explicit
-- grants below make a clean re-provision self-sufficient.
--
-- NOTE: trade-in *values* (provisional/recommended/accepted) are internal
-- appraisal figures the business keeps — NOT customer sale prices. In scope.
--
-- Still pending capture (separate migration once dumped): the customers_display
-- view and the cars UPDATE policy.
-- ============================================

CREATE OR REPLACE FUNCTION public.has_capability(cap user_capability)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and cap = any(p.capabilities)
  );
$function$;

CREATE OR REPLACE FUNCTION public.move_part_stock(p_part_id uuid, p_movement_type text, p_quantity integer, p_car_id uuid DEFAULT NULL::uuid, p_job_description text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_qty integer;
  v_new_qty integer;
BEGIN
  SELECT quantity INTO v_current_qty FROM public.parts WHERE id = p_part_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  IF p_movement_type = 'stock_in' OR p_movement_type = 'return' THEN
    v_new_qty = v_current_qty + p_quantity;
  ELSIF p_movement_type = 'stock_out' THEN
    v_new_qty = v_current_qty - p_quantity;
    IF v_new_qty < 0 THEN
      RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_qty, p_quantity;
    END IF;
  ELSIF p_movement_type = 'adjustment' THEN
    v_new_qty = p_quantity;
  ELSE
    RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
  END IF;

  UPDATE public.parts SET quantity = v_new_qty WHERE id = p_part_id;

  INSERT INTO public.part_movements (part_id, movement_type, quantity, car_id, job_description, note, created_by)
  VALUES (p_part_id, p_movement_type, p_quantity, p_car_id, p_job_description, p_note, p_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_trade_in(p_customer_id uuid, p_vehicle_make text, p_vehicle_model text, p_provisional_value numeric, p_currency text DEFAULT 'USD'::text, p_vehicle_year integer DEFAULT NULL::integer, p_vehicle_vin text DEFAULT NULL::text, p_vehicle_plate text DEFAULT NULL::text, p_vehicle_color text DEFAULT NULL::text, p_vehicle_trim text DEFAULT NULL::text, p_mileage_km integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.start_trade_in_inspection(p_trade_in_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.complete_trade_in_inspection(p_trade_in_id uuid, p_condition text, p_recommended_value numeric, p_mileage_km integer DEFAULT NULL::integer, p_estimated_repair_cost numeric DEFAULT NULL::numeric, p_inspection_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.approve_trade_in(p_trade_in_id uuid, p_accepted_value numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reject_trade_in(p_trade_in_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cancel_trade_in(p_trade_in_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

-- Grants (make a clean re-provision self-sufficient; no-ops where already set).
GRANT EXECUTE ON FUNCTION public.has_capability(user_capability) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_part_stock(uuid, text, integer, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_trade_in(uuid, text, text, numeric, text, integer, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_trade_in_inspection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trade_in_inspection(uuid, text, numeric, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_trade_in(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_trade_in(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trade_in(uuid, text) TO authenticated;
