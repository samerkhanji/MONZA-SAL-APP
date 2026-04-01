-- ============================================
-- MONZA CRM - Car Inventory Fields (per spec)
-- Migration 009: issue, software_update, dongle, sold_marker, suffix,
-- engine_number, client_name, delivery_date, client_phone, reserved_by, reservation_date
-- ============================================

ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS issue TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS software_update TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS dongle TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS sold_marker TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS engine_number TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS reserved_by TEXT;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS reservation_date DATE;

-- Add new car_status enum values if not present (for Excel import mapping)
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'registered';
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'under_registration';
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'sent_to_customs';
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'company_car';
