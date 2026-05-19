-- ============================================================================
-- 132_sales_order_deposit_requires_quote.sql
--
-- Enforce lifecycle ordering: a sales order cannot have a deposit_paid_at
-- before a quote_sent_at. This catches the bug where Sales recorded a
-- deposit without ever sending the quote — bypassing the standard flow and
-- making downstream reports inconsistent.
--
-- The CHECK is permissive: NULLs on either side are fine; the constraint
-- only fires when deposit_paid_at is set AND quote_sent_at is NULL.
--
-- Existing rows must not break the migration in production: backfill
-- quote_sent_at = deposit_paid_at - 1s for any pre-existing violators so
-- they pass the new constraint without losing data.
-- ============================================================================

-- Backfill first so prod data passes the new CHECK.
UPDATE public.sales_orders
   SET quote_sent_at = COALESCE(quote_sent_at, deposit_paid_at - interval '1 second')
 WHERE deposit_paid_at IS NOT NULL
   AND quote_sent_at IS NULL;

-- Drop any prior version of this constraint so the migration is idempotent.
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS lifecycle_deposit_after_quote;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT lifecycle_deposit_after_quote
  CHECK (deposit_paid_at IS NULL OR quote_sent_at IS NOT NULL);

COMMENT ON CONSTRAINT lifecycle_deposit_after_quote ON public.sales_orders IS
  'A deposit cannot be recorded before a quote has been sent. UI complements this with a friendly toast.';
