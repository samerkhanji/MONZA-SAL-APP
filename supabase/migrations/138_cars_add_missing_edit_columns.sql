-- ============================================
-- MONZA CRM - Add missing columns used by the car edit forms
-- Migration 138
--
-- The Add Car and Edit Car dialogs write motor / warranty_vehicle_km_limit
-- / warranty_battery_km_limit / warranty_battery_dms to public.cars, but
-- those columns were never present. Every Edit Car save therefore failed
-- with a "could not find column ... in the schema cache" error, and the
-- EREV/warranty fields on Add Car failed the same way. Additive, nullable
-- columns -- safe.
--
-- Applied to live project okxpsvukzjjubinhamek as
-- `cars_add_missing_edit_columns`.
-- ============================================

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS motor                     text,
  ADD COLUMN IF NOT EXISTS warranty_vehicle_km_limit numeric,
  ADD COLUMN IF NOT EXISTS warranty_battery_km_limit numeric,
  ADD COLUMN IF NOT EXISTS warranty_battery_dms      date;
