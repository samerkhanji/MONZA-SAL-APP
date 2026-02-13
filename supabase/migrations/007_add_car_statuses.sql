-- ============================================
-- MONZA TECH CRM - Add car statuses
-- Migration 007: sent_to_sub_dealer, demo
-- ============================================

DO $$ BEGIN
  ALTER TYPE car_status ADD VALUE 'sent_to_sub_dealer';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE car_status ADD VALUE 'demo';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
