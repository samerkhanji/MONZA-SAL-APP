-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260409095527 as `052_accessory_car_id_refactor`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Migration 052: Replace linked_plate with car_id in accessories

-- 1. Add car_id to accessory_inventory
ALTER TABLE public.accessory_inventory
ADD COLUMN car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL;

-- 2. Add car_id to accessory_custom_items
ALTER TABLE public.accessory_custom_items
ADD COLUMN car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL;

-- 3. Create views to expose assigned_vehicle_display
CREATE OR REPLACE VIEW public.accessory_inventory_view AS
SELECT 
  ai.id,
  ai.category,
  ai.label,
  ai.quantity,
  ai.note,
  ai.car_id,
  ai.created_at,
  ai.updated_at,
  COALESCE(NULLIF(TRIM(c.plate_number), ''), NULLIF(TRIM(c.vin), '')) AS assigned_vehicle_display
FROM public.accessory_inventory ai
LEFT JOIN public.cars c ON ai.car_id = c.id;

CREATE OR REPLACE VIEW public.accessory_custom_items_view AS
SELECT 
  aci.id,
  aci.table_id,
  aci.label,
  aci.quantity,
  aci.note,
  aci.car_id,
  aci.created_at,
  aci.updated_at,
  COALESCE(NULLIF(TRIM(c.plate_number), ''), NULLIF(TRIM(c.vin), '')) AS assigned_vehicle_display
FROM public.accessory_custom_items aci
LEFT JOIN public.cars c ON aci.car_id = c.id;

-- Note: We are keeping the linked_plate column for backward compatibility during deployment,
-- but we will stop reading from it in the app.
