-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260423130124 as `final_orphan_cleanup_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Drop base tables that have 0 rows AND 0 code references.
DROP TABLE IF EXISTS public.car_accessories      CASCADE;
DROP TABLE IF EXISTS public.accessory_inventory  CASCADE;
DROP TABLE IF EXISTS public.garage_job_events    CASCADE;
DROP TABLE IF EXISTS public.request_attachments  CASCADE;
DROP TABLE IF EXISTS public.departments          CASCADE;

-- Drop back-compat alias views — code now uses the renamed canonical tables.
DROP VIEW IF EXISTS public.proposal_items CASCADE;
DROP VIEW IF EXISTS public.time_entries   CASCADE;

-- Drop unused data-health views (0 code references; advisor-relevant).
DROP VIEW IF EXISTS public.accessory_inventory_display            CASCADE;
DROP VIEW IF EXISTS public.data_health_car_without_vin            CASCADE;
DROP VIEW IF EXISTS public.data_health_customer_multiple_sales    CASCADE;
DROP VIEW IF EXISTS public.data_health_customer_without_phone     CASCADE;
DROP VIEW IF EXISTS public.data_health_duplicate_customer_names   CASCADE;
DROP VIEW IF EXISTS public.data_health_placeholder_phones         CASCADE;
DROP VIEW IF EXISTS public.data_health_sold_car_without_sales_order CASCADE;

-- cars_missing_data view IS used by code (8 refs) — keep it.

-- Clean up: drop column on profiles that's never read anywhere: department_id (0 refs)
-- Wait: department_id FK'd to departments which we just dropped — ON DELETE NO ACTION
-- may have forced CASCADE to drop the FK. Let's also drop the column since dept is gone.
ALTER TABLE public.profiles   DROP COLUMN IF EXISTS department_id;
-- Same on requests (already dropped earlier)... and installments had one but that table's gone.
