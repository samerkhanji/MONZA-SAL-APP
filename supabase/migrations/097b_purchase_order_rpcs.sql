-- RPCs for the PO lifecycle. All SECURITY DEFINER so they can call
-- emit_notification + update stock atomically. Capability checks done
-- inline rather than via RLS so we get clean error messages.

CREATE OR REPLACE FUNCTION public.submit_purchase_order(p_po_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller    uuid := auth.uid();
  v_po        public.purchase_orders;
  v_total     numeric;
  v_required  text;
  v_next      text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('inventory'::user_capability)) THEN
    RAISE EXCEPTION 'Only inventory / owner can submit POs' USING errcode = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_order % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status <> 'draft' THEN
    RAISE EXCEPTION 'PO is %, must be draft', v_po.status USING errcode = '40000';
  END IF;

  SELECT COALESCE(sum(line_total), 0) INTO v_total
    FROM public.purchase_order_lines WHERE po_id = p_po_id;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'PO has no lines' USING errcode = '23514';
  END IF;

  v_required := public.required_approver('parts_order', v_total);
  v_next := CASE
    WHEN v_required IN ('manager','owner') THEN 'pending_approval'
    ELSE 'approved'
  END;

  UPDATE public.purchase_orders
     SET status            = v_next,
         estimated_total   = v_total,
         requested_by      = COALESCE(v_po.requested_by, v_caller),
         approved_by       = CASE WHEN v_next = 'approved' THEN v_caller ELSE NULL END,
         approved_at       = CASE WHEN v_next = 'approved' THEN now() ELSE NULL END,
         updated_at        = now()
   WHERE id = p_po_id;

  IF v_next = 'pending_approval' THEN
    PERFORM public.emit_notification(
      'purchase_order.needs_owner_approval',
      'PO ' || v_po.po_number || ' needs approval',
      'Total ' || v_total::text || ' ' || v_po.currency
        || ' (above parts_order threshold). Requested by '
        || COALESCE((SELECT full_name FROM public.profiles WHERE id = v_caller), 'unknown'),
      'purchase_order',
      p_po_id,
      '/garage/purchase-orders/' || p_po_id::text,
      jsonb_build_object('po_id', p_po_id, 'po_number', v_po.po_number, 'total', v_total),
      v_caller,
      NULL
    );
  ELSE
    PERFORM public.emit_notification(
      'purchase_order.approved',
      'PO ' || v_po.po_number || ' auto-approved',
      'Total ' || v_total::text || ' ' || v_po.currency
        || ' is below threshold — ready to send to supplier.',
      'purchase_order',
      p_po_id,
      '/garage/purchase-orders/' || p_po_id::text,
      jsonb_build_object('po_id', p_po_id, 'po_number', v_po.po_number),
      v_caller,
      NULL
    );
  END IF;

  RETURN jsonb_build_object('po_id', p_po_id, 'status', v_next, 'total', v_total);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_purchase_order(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_purchase_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_po     public.purchase_orders;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can approve POs' USING errcode = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'PO is %, must be pending_approval', v_po.status USING errcode = '40000';
  END IF;

  UPDATE public.purchase_orders
     SET status      = 'approved',
         approved_by = v_caller,
         approved_at = now(),
         updated_at  = now()
   WHERE id = p_po_id;

  PERFORM public.emit_notification(
    'purchase_order.approved',
    'PO ' || v_po.po_number || ' approved',
    'Ready to send to supplier.',
    'purchase_order', p_po_id,
    '/garage/purchase-orders/' || p_po_id::text,
    jsonb_build_object('po_id', p_po_id, 'po_number', v_po.po_number),
    v_po.requested_by, NULL
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_purchase_order(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_purchase_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_purchase_order(p_po_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_po     public.purchase_orders;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can reject POs' USING errcode = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to reject a PO' USING errcode = '23514';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'PO is %, must be pending_approval', v_po.status USING errcode = '40000';
  END IF;

  UPDATE public.purchase_orders
     SET status           = 'rejected',
         rejected_by      = v_caller,
         rejected_at      = now(),
         rejection_reason = p_reason,
         updated_at       = now()
   WHERE id = p_po_id;

  PERFORM public.emit_notification(
    'purchase_order.rejected',
    'PO ' || v_po.po_number || ' rejected',
    'Reason: ' || p_reason,
    'purchase_order', p_po_id,
    '/garage/purchase-orders/' || p_po_id::text,
    jsonb_build_object('po_id', p_po_id, 'po_number', v_po.po_number, 'reason', p_reason),
    v_po.requested_by, NULL
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reject_purchase_order(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_purchase_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_purchase_order(
  p_po_id              uuid,
  p_supplier_contact   text DEFAULT NULL,
  p_supplier_reference text DEFAULT NULL,
  p_expected_delivery  date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_po     public.purchase_orders;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('inventory'::user_capability)) THEN
    RAISE EXCEPTION 'Only inventory / owner can send POs' USING errcode = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status <> 'approved' THEN
    RAISE EXCEPTION 'PO is %, must be approved', v_po.status USING errcode = '40000';
  END IF;

  UPDATE public.purchase_orders
     SET status              = 'sent_to_supplier',
         sent_at             = now(),
         sent_by             = v_caller,
         supplier_contact    = COALESCE(p_supplier_contact, supplier_contact),
         supplier_reference  = COALESCE(p_supplier_reference, supplier_reference),
         expected_delivery_at = COALESCE(p_expected_delivery, expected_delivery_at),
         updated_at          = now()
   WHERE id = p_po_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_purchase_order(uuid, text, text, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_purchase_order(uuid, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_purchase_order_receipt(
  p_po_id          uuid,
  p_grn_number     text,
  p_received_lines jsonb,
  p_condition_note text DEFAULT NULL,
  p_photos         text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller    uuid := auth.uid();
  v_po        public.purchase_orders;
  v_receipt_id uuid;
  v_line      jsonb;
  v_pl_id     uuid;
  v_qty       numeric;
  v_cond      text;
  v_note      text;
  v_part_id   uuid;
  v_total_ordered numeric;
  v_total_received numeric;
  v_new_status text;
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

    INSERT INTO public.purchase_order_receipt_lines
      (receipt_id, po_line_id, quantity_received, condition, note)
    VALUES (v_receipt_id, v_pl_id, v_qty, v_cond, v_note);

    IF v_cond IN ('good', 'extra') AND v_qty > 0 THEN
      SELECT part_id INTO v_part_id
        FROM public.purchase_order_lines WHERE id = v_pl_id;
      IF v_part_id IS NOT NULL THEN
        UPDATE public.parts
           SET quantity   = COALESCE(quantity, 0) + v_qty::integer,
               updated_at = now()
         WHERE id = v_part_id;
      END IF;
    END IF;
  END LOOP;

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
    '/garage/purchase-orders/' || p_po_id::text,
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

REVOKE EXECUTE ON FUNCTION public.record_purchase_order_receipt(uuid, text, jsonb, text, text[])
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_purchase_order_receipt(uuid, text, jsonb, text, text[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_purchase_order_invoice(
  p_po_id       uuid,
  p_invoice_no  text,
  p_invoice_date date,
  p_amount      numeric,
  p_currency    text DEFAULT 'USD',
  p_vat         numeric DEFAULT 0,
  p_due_at      date DEFAULT NULL,
  p_file_url    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_po     public.purchase_orders;
  v_id     uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner()
       OR public.has_capability('inventory'::user_capability)
       OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only inventory / cashier / owner can attach invoices'
      USING errcode = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status NOT IN ('partially_received','received','invoiced','paid','sent_to_supplier') THEN
    RAISE EXCEPTION 'Cannot attach invoice against PO status %', v_po.status USING errcode = '40000';
  END IF;

  INSERT INTO public.purchase_order_invoices
    (po_id, supplier_invoice_number, invoice_date, amount, currency, vat_amount, due_at, file_url, attached_by)
  VALUES
    (p_po_id, p_invoice_no, p_invoice_date, p_amount, p_currency, p_vat, p_due_at, p_file_url, v_caller)
  RETURNING id INTO v_id;

  IF v_po.status NOT IN ('paid') THEN
    UPDATE public.purchase_orders
       SET status     = CASE WHEN v_po.status = 'received' THEN 'invoiced' ELSE v_po.status END,
           updated_at = now()
     WHERE id = p_po_id;
  END IF;

  PERFORM public.emit_notification(
    'purchase_order.invoice_attached',
    'PO ' || v_po.po_number || ' — invoice ' || p_invoice_no || ' attached',
    'Amount ' || p_amount::text || ' ' || p_currency
      || COALESCE(' · due ' || p_due_at::text, ''),
    'purchase_order', p_po_id,
    '/garage/purchase-orders/' || p_po_id::text,
    jsonb_build_object('po_id', p_po_id, 'invoice_id', v_id, 'amount', p_amount),
    v_po.requested_by, NULL
  );

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.attach_purchase_order_invoice(uuid, text, date, numeric, text, numeric, date, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.attach_purchase_order_invoice(uuid, text, date, numeric, text, numeric, date, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.record_purchase_order_payment(
  p_po_id      uuid,
  p_invoice_id uuid,
  p_amount     numeric,
  p_method     text,
  p_currency   text DEFAULT 'USD',
  p_reference  text DEFAULT NULL,
  p_notes      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller   uuid := auth.uid();
  v_po       public.purchase_orders;
  v_inv      public.purchase_order_invoices;
  v_paid_sum numeric;
  v_id       uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only cashier / owner can record PO payments' USING errcode = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0' USING errcode = '23514';
  END IF;
  IF p_method NOT IN ('cash','bank_transfer','cheque','card','other') THEN
    RAISE EXCEPTION 'Unknown payment method %', p_method USING errcode = '23514';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.purchase_order_invoices
      WHERE id = p_invoice_id AND po_id = p_po_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice % not on this PO', p_invoice_id USING errcode = '02000';
    END IF;
  END IF;

  INSERT INTO public.purchase_order_payments
    (po_id, invoice_id, amount, currency, payment_method, reference, paid_at, paid_by, notes)
  VALUES
    (p_po_id, p_invoice_id, p_amount, p_currency, p_method, p_reference, now(), v_caller, p_notes)
  RETURNING id INTO v_id;

  IF p_invoice_id IS NOT NULL THEN
    SELECT COALESCE(sum(amount), 0) INTO v_paid_sum
      FROM public.purchase_order_payments WHERE invoice_id = p_invoice_id;
    IF v_paid_sum >= v_inv.amount THEN
      UPDATE public.purchase_order_invoices
         SET status = 'paid', updated_at = now()
       WHERE id = p_invoice_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_order_invoices
     WHERE po_id = p_po_id AND status <> 'paid'
  ) AND EXISTS (
    SELECT 1 FROM public.purchase_order_invoices WHERE po_id = p_po_id
  ) THEN
    UPDATE public.purchase_orders SET status = 'paid', updated_at = now() WHERE id = p_po_id;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_purchase_order_payment(uuid, uuid, numeric, text, text, text, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_purchase_order_payment(uuid, uuid, numeric, text, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_po     public.purchase_orders;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('inventory'::user_capability)) THEN
    RAISE EXCEPTION 'Only inventory / owner can cancel POs' USING errcode = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to cancel a PO' USING errcode = '23514';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO % not found', p_po_id USING errcode = '02000';
  END IF;
  IF v_po.status IN ('received','invoiced','paid','cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel PO in status %', v_po.status USING errcode = '40000';
  END IF;

  UPDATE public.purchase_orders
     SET status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = v_caller,
         cancel_reason = p_reason,
         updated_at    = now()
   WHERE id = p_po_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_purchase_order(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_purchase_order(uuid, text) TO authenticated;
