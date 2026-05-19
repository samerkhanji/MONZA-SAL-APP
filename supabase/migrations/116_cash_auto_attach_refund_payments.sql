-- ============================================================================
-- 116_cash_auto_attach_refund_payments.sql
--
-- Auto-attach refund cash payments to the open cash session as a movement.
-- Mirrors the existing pattern used by installment_payment_to_cash_movement
-- (see migration 113) so refunds paid out in cash appear on the daily
-- reconciliation report without manual movement entry.
--
-- Fires AFTER UPDATE on public.refunds when status flips to 'paid' AND the
-- payment_method is 'cash'. If no open session exists we return NEW silently;
-- migration 119 already blocks cash installment payments without an open
-- session via the RPC, but refunds use a simple UPDATE path so we
-- intentionally do not raise here to avoid breaking the existing
-- mark_refund_paid() flow.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refund_payment_to_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_session  uuid;
BEGIN
  IF NOT (OLD.status <> 'paid' AND NEW.status = 'paid' AND NEW.payment_method = 'cash') THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_session
    FROM public.cash_sessions s
    JOIN public.cash_drawers d ON d.id = s.drawer_id
   WHERE s.status = 'open' AND d.active = true
   ORDER BY d.created_at
   LIMIT 1;

  IF v_session IS NULL THEN
    -- No open session — silently skip. Migration 119 covers cash-without-session
    -- for installments via the RPC; refund flow chooses to record-then-reconcile
    -- rather than block.
    RETURN NEW;
  END IF;

  INSERT INTO public.cash_movements
    (session_id, kind, direction, amount, source_type, source_id, note, created_by)
  VALUES
    (v_session, 'refund', 'out', NEW.amount,
     'refund', NEW.id,
     'Refund ' || NEW.refund_number || ' (auto)',
     NEW.paid_by)
  ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_refund_payment_to_cash_movement ON public.refunds;
CREATE TRIGGER trg_refund_payment_to_cash_movement
AFTER UPDATE OF status ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.refund_payment_to_cash_movement();

COMMENT ON FUNCTION public.refund_payment_to_cash_movement IS
  'Auto-records a cash refund as a cash_movements row (kind=refund, direction=out) on the single open session. Silently skips if no session is open.';
