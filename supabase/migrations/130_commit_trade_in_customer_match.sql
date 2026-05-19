-- ============================================================================
-- 130_commit_trade_in_customer_match.sql
--
-- Tighten public.commit_trade_in_to_sale(uuid, uuid):
--   Before linking a trade-in to a sales order, verify that BOTH rows belong
--   to the same customer. Otherwise the trade-in credit could be applied to
--   a sale for a completely different person (data integrity bug).
--
-- Everything else (caller-role check, status='approved', accepted_value NOT
-- NULL, the notification emit) stays intact.
-- ============================================================================

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
  v_t  public.trade_ins;
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

  -- Customer-match guard: the trade-in and the sales order MUST be for the
  -- same customer. Catches the "wrong sale picked from the dropdown" case.
  IF v_t.customer_id IS DISTINCT FROM v_so.customer_id THEN
    RAISE EXCEPTION
      'Trade-in customer (%) does not match sales-order customer (%)',
      v_t.customer_id, v_so.customer_id
      USING errcode = '40000';
  END IF;

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
