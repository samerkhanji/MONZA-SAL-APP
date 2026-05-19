-- 123_grn_over_receipt_block.sql
-- Enforce a per-line over-receipt cap inside record_purchase_order_receipt.
-- For each receipt line: lock the matching purchase_order_lines row, sum prior
-- quantity_received from purchase_order_receipt_lines, and reject the receipt
-- if running + new_qty > line.quantity (the ordered qty).
--
-- Error: SQLSTATE 40000 with message
--   'Over-receipt blocked on line %: %/% already received, attempting % more'

CREATE OR REPLACE FUNCTION public.record_purchase_order_receipt(
  p_po_id uuid,
  p_grn_number text,
  p_received_lines jsonb,
  p_condition_note text DEFAULT NULL::text,
  p_photos text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_caller         uuid := auth.uid();
  v_po             public.purchase_orders;
  v_receipt_id     uuid;
  v_line           jsonb;
  v_pl             public.purchase_order_lines;
  v_pl_id          uuid;
  v_qty            numeric;
  v_cond           text;
  v_note           text;
  v_part_id        uuid;
  v_already_recv   numeric;
  v_total_ordered  numeric;
  v_total_received numeric;
  v_new_status     text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('inventory'::user_capability)) THEN
    RAISE EXCEPTION 'Only inventory / owner can log receipts' USING errcode = '42501';
  END IF;
  IF p_grn_number IS NULL OR length(trim(p_grn_number)) = 0 THEN
    RAISE EXCEPTION 'GRN number is required' USING errcode = '23514';
  END IF;
  IF jsonb_typeof(p_received_lines) <> 'array' OR jsonb_array_length(p_received_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING errcode = '23514';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status NOT IN ('sent_to_supplier', 'partially_received', 'approved') THEN
    RAISE EXCEPTION 'Cannot log receipt against PO status %', v_po.status USING errcode = '40000';
  END IF;

  INSERT INTO public.purchase_order_receipts (
    po_id, grn_number, received_at, received_by, condition_note, photos
  ) VALUES (
    p_po_id, p_grn_number, now(), v_caller, p_condition_note,
    COALESCE(p_photos, ARRAY[]::text[])
  ) RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT jsonb_array_elements(p_received_lines)
  LOOP
    v_pl_id := (v_line ->> 'po_line_id')::uuid;
    v_qty   := (v_line ->> 'quantity_received')::numeric;
    v_cond  := COALESCE(v_line ->> 'condition', 'good');
    v_note  := v_line ->> 'note';

    IF v_pl_id IS NULL OR v_qty IS NULL THEN
      RAISE EXCEPTION 'Each line needs po_line_id and quantity_received' USING errcode = '23514';
    END IF;

    -- Lock the PO line and enforce per-line over-receipt cap.
    SELECT * INTO v_pl
      FROM public.purchase_order_lines
     WHERE id = v_pl_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO line % not found', v_pl_id USING errcode = '02000';
    END IF;

    SELECT COALESCE(sum(quantity_received), 0)
      INTO v_already_recv
      FROM public.purchase_order_receipt_lines
     WHERE po_line_id = v_pl_id;

    IF v_already_recv + v_qty > v_pl.quantity THEN
      RAISE EXCEPTION 'Over-receipt blocked on line %: %/% already received, attempting % more',
        v_pl_id, v_already_recv, v_pl.quantity, v_qty
        USING errcode = '40000';
    END IF;

    INSERT INTO public.purchase_order_receipt_lines
      (receipt_id, po_line_id, quantity_received, condition, note)
    VALUES (v_receipt_id, v_pl_id, v_qty, v_cond, v_note);

    -- Bump part stock only for good/extra; damaged/wrong_item/short don't add.
    IF v_cond IN ('good', 'extra') AND v_qty > 0 THEN
      v_part_id := v_pl.part_id;
      IF v_part_id IS NOT NULL THEN
        UPDATE public.parts
           SET quantity   = COALESCE(quantity, 0) + v_qty::integer,
               updated_at = now()
         WHERE id = v_part_id;
      END IF;
    END IF;
  END LOOP;

  -- Recompute PO status from cumulative receipts.
  SELECT COALESCE(sum(quantity), 0) INTO v_total_ordered
    FROM public.purchase_order_lines WHERE po_id = p_po_id;
  SELECT COALESCE(sum(rl.quantity_received), 0)
    INTO v_total_received
    FROM public.purchase_order_receipt_lines rl
    JOIN public.purchase_order_receipts r ON r.id = rl.receipt_id
   WHERE r.po_id = p_po_id
     AND rl.condition IN ('good', 'extra');

  v_new_status := CASE
    WHEN v_total_received <= 0                  THEN v_po.status
    WHEN v_total_received >= v_total_ordered    THEN 'received'
    ELSE                                              'partially_received'
  END;

  IF v_new_status <> v_po.status THEN
    UPDATE public.purchase_orders
       SET status     = v_new_status,
           updated_at = now()
     WHERE id = p_po_id;
  END IF;

  PERFORM public.emit_notification(
    CASE WHEN v_new_status = 'received'
         THEN 'purchase_order.received_full'
         ELSE 'purchase_order.received_partial'
    END,
    'PO ' || v_po.po_number || ' — '
      || CASE WHEN v_new_status = 'received' THEN 'fully received' ELSE 'partial receipt' END,
    'GRN ' || p_grn_number || ' logged.',
    'purchase_order', p_po_id,
    '/parts/purchase-orders/' || p_po_id::text,
    jsonb_build_object(
      'po_id', p_po_id, 'po_number', v_po.po_number, 'grn_number', p_grn_number,
      'received_qty', v_total_received, 'ordered_qty', v_total_ordered
    ),
    v_po.requested_by, NULL
  );

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'po_status', v_new_status,
    'received_qty', v_total_received,
    'ordered_qty', v_total_ordered
  );
END;
$function$;
