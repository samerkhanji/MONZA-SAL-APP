-- ============================================
-- MONZA CRM - First Login & Onboarding
-- Migration 015: must_change_password and onboarding flags
-- ============================================

-- 1) Add first-login and onboarding flags to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 2) Set existing admin (Samer) to skip forced password change and onboarding

UPDATE public.profiles
SET must_change_password = false,
    onboarding_completed = true,
    onboarding_completed_at = NOW()
WHERE full_name = 'Samer Khanji';

