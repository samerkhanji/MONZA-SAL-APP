-- ============================================
-- MONZA CRM — date_bought on public.sales_orders
-- Migration 030
--
-- Source of truth: public.sales_orders.date_bought (vehicle purchase / deal date).
-- cars_display is rebuilt in 032 (DROP + CREATE) so Postgres does not reject
-- CREATE OR REPLACE VIEW when output column order/types change.
-- RLS unchanged: existing sales_orders policies apply to all columns.
-- ============================================

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS date_bought DATE;

COMMENT ON COLUMN public.sales_orders.date_bought IS
  'Date the vehicle was bought / deal closed (relational sales flow).';

-- Backfill from existing sale_date where date_bought is still null
UPDATE public.sales_orders
SET date_bought = sale_date
WHERE date_bought IS NULL
  AND sale_date IS NOT NULL;
