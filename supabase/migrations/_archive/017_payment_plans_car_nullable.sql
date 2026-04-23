-- ============================================
-- MONZA CRM - Payment plans car nullable
-- Migration 017: allow payment_plans.car_id to be NULL for plans
-- created before a car is linked.
-- ============================================

ALTER TABLE public.payment_plans
  ALTER COLUMN car_id DROP NOT NULL;

