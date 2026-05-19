-- ============================================================================
-- 117_cash_auto_attach_po_payments.sql
--
-- Auto-attach purchase-order cash payments to the open cash session as an
-- expense movement. Same pattern as 113/116: find the single open session
-- and INSERT a cash_movement row referencing the PO payment; ON CONFLICT
-- DO NOTHING (matching the partial unique index on source_type/source_id).
--
-- Fires AFTER INSERT on public.purchase_order_payments when method = 'cash'.
-- Note: the column is `payment_method` (not `method`) in this table — the
-- task spec used 'method' as shorthand. We dereference NEW.payment_method.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.po_payment_to_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_session    uuid;
  v_invoice_no text;
BEGIN
  IF NEW.payment_method IS DISTINCT FROM 'cash' THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_session
    FROM public.cash_sessions s
    JOIN public.cash_drawers d ON d.id = s.drawer_id
   WHERE s.status = 'open' AND d.active = true
   ORDER BY d.created_at
   LIMIT 1;

  IF v_session IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT supplier_invoice_number INTO v_invoice_no
    FROM public.purchase_order_invoices
   WHERE id = NEW.invoice_id;

  INSERT INTO public.cash_movements
    (session_id, kind, direction, amount, source_type, source_id, note, created_by)
  VALUES
    (v_session, 'expense', 'out', NEW.amount,
     'po_payment', NEW.id,
     'PO payment for invoice ' || COALESCE(v_invoice_no, NEW.invoice_id::text),
     NEW.paid_by)
  ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_po_payment_to_cash_movement ON public.purchase_order_payments;
CREATE TRIGGER trg_po_payment_to_cash_movement
AFTER INSERT ON public.purchase_order_payments
FOR EACH ROW
EXECUTE FUNCTION public.po_payment_to_cash_movement();

COMMENT ON FUNCTION public.po_payment_to_cash_movement IS
  'Auto-records a cash PO payment as a cash_movements row (kind=expense, direction=out) on the single open session. Silently skips if no session is open.';
