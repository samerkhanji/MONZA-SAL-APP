-- ============================================
-- MONZA CRM - Recall Center columns on cars
-- Migration 137
--
-- Tracks cars recalled back to the manufacturer (Voyah) for shipping
-- logistics or vehicle issues. A car is "in recall" when recalled_at is
-- not null. The Recall Center page lists these cars. Additive, nullable
-- columns -- safe.
--
-- Applied to live project okxpsvukzjjubinhamek as
-- `cars_recall_to_company_columns`.
-- ============================================

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS recalled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS recall_reason text,
  ADD COLUMN IF NOT EXISTS recall_notes  text;

ALTER TABLE public.cars
  DROP CONSTRAINT IF EXISTS cars_recall_reason_check;

ALTER TABLE public.cars
  ADD CONSTRAINT cars_recall_reason_check
  CHECK (recall_reason IS NULL OR recall_reason IN ('shipping', 'issue'));
