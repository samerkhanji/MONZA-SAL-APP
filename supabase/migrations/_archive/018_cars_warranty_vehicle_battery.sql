-- ============================================
-- MONZA CRM - Car Warranty Fields (Vehicle & Battery)
-- Migration 018: add warranty_vehicle_expiry, warranty_battery_expiry
-- ============================================

-- 1) Add new warranty expiry fields on cars

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS warranty_vehicle_expiry DATE,
  ADD COLUMN IF NOT EXISTS warranty_battery_expiry DATE;

-- 2) Extend warranty_notifications_sent.warranty_type constraint
-- to support new warranty categories while keeping existing ones

ALTER TABLE public.warranty_notifications_sent
  DROP CONSTRAINT IF EXISTS warranty_notifications_sent_warranty_type_check;

ALTER TABLE public.warranty_notifications_sent
  ADD CONSTRAINT warranty_notifications_sent_warranty_type_check
  CHECK (warranty_type IN ('dms', 'monza', 'vehicle', 'battery'));

