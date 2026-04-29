-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424091616 as `cars_add_warranty_expiry_compat_cols`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- assistant-dashboard selects these directly from `cars`. The canonical values
-- live on car_warranties, but the code expects flat columns on cars. Add
-- nullable mirrors so the query no longer 400s.
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS warranty_vehicle_expiry date;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS warranty_battery_expiry date;

-- Kick PostgREST again so it picks up the new columns immediately.
NOTIFY pgrst, 'reload schema';
