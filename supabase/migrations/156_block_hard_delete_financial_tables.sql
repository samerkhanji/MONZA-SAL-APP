-- ============================================
-- Monza S.A.L. — financial / audit-sensitive record immutability
-- Migration 156
--
-- Financial records (invoices, sales orders, installment payments, cash
-- movements, purchase orders + their child rows, refunds) must NEVER be
-- hard-deleted. Lebanese tax authorities and standard accounting audit
-- practice require these records to be retained immutably. Any
-- "cancellation" must move through explicit status transitions
-- (void / cancelled / refunded / reversed / adjusted) so the audit trail
-- is preserved.
--
-- A BEFORE DELETE trigger on each table raises a clear permission error
-- so an accidental DELETE from the UI, an API route, Studio, or a script
-- gets a friendly message pointing to the appropriate void/cancel/reverse
-- RPC.
--
-- This trigger function is SECURITY INVOKER (default). It only raises an
-- exception; there is no privilege-escalation surface here.
-- ============================================

CREATE OR REPLACE FUNCTION public.block_hard_delete_financial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Hard delete of public.%(id=%) is not permitted. Financial and audit-sensitive records are immutable for accounting/tax compliance.',
    TG_TABLE_NAME, COALESCE((to_jsonb(OLD) ->> 'id'), '?')
  USING
    ERRCODE = '42501',
    HINT    = 'Move the record to a void/cancelled/refunded/reversed/adjusted status via the appropriate RPC (void_sales_order, request_refund, etc.). Never DELETE.';
END;
$$;

COMMENT ON FUNCTION public.block_hard_delete_financial() IS
  'BEFORE DELETE trigger function for financial/audit-sensitive tables. Records are immutable; use status transitions (void/cancelled/refunded/reversed/adjusted) instead.';

-- Apply to every existing financial table. Idempotent via DROP TRIGGER IF EXISTS.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'invoices',
    'sales_orders',
    'installment_payments',
    'cash_movements',
    'purchase_orders',
    'purchase_order_payments',
    'purchase_order_invoices',
    'refunds'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_block_delete ON public.%I', tbl, tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_%I_block_delete '
        'BEFORE DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete_financial()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
