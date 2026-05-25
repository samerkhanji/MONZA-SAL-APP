-- ============================================
-- Monza S.A.L. — single-currency (USD) operations
-- Migration 158
--
-- Per launch decision: the company operates in USD. The 19 AED-labeled
-- sales_orders and 1 EUR-labeled car uncovered during the launch audit
-- were data-entry mistakes — the amounts ARE already USD figures, only
-- the currency tag was wrong.
--
-- This migration:
--   1. Sets currency = 'USD' on every row in every money-bearing table
--      where it was NULL or non-USD.
--   2. Locks the column defaults to 'USD' so future inserts default to
--      the correct value.
--
-- It does NOT modify amounts, and does NOT convert at an exchange rate
-- (Samer's call: amounts are already in USD).
-- ============================================

UPDATE public.sales_orders          SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.sales_orders          SET deposit_currency = 'USD' WHERE deposit_currency IS NULL OR deposit_currency <> 'USD';
UPDATE public.sales_orders          SET quote_currency = 'USD'   WHERE quote_currency IS NULL OR quote_currency <> 'USD';
UPDATE public.cars                  SET price_currency = 'USD'   WHERE price_currency IS NULL OR price_currency <> 'USD';
UPDATE public.cars                  SET customs_amount_currency = 'USD' WHERE customs_amount_currency IS NULL OR customs_amount_currency <> 'USD';
UPDATE public.cash_movements        SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.cash_settings         SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.commissions           SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.company_costs         SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.customer_credits      SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.invoices              SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.parts                 SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.purchase_orders       SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.purchase_order_invoices SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.purchase_order_payments SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.refunds               SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.trade_ins             SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.approval_thresholds   SET currency = 'USD' WHERE currency IS NULL OR currency <> 'USD';
UPDATE public.marketing_campaigns   SET budget_currency = 'USD' WHERE budget_currency IS NULL OR budget_currency <> 'USD';
UPDATE public.job_parts             SET currency_snapshot = 'USD' WHERE currency_snapshot IS NULL OR currency_snapshot <> 'USD';

ALTER TABLE public.sales_orders          ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.cars                  ALTER COLUMN price_currency SET DEFAULT 'USD';
ALTER TABLE public.cars                  ALTER COLUMN customs_amount_currency SET DEFAULT 'USD';
ALTER TABLE public.cash_movements        ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.cash_settings         ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.commissions           ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.company_costs         ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.customer_credits      ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.invoices              ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.parts                 ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.purchase_orders       ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.purchase_order_invoices ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.purchase_order_payments ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.refunds               ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.trade_ins             ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.marketing_campaigns   ALTER COLUMN budget_currency SET DEFAULT 'USD';
