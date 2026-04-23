-- ============================================
-- MONZA CRM — Garage manager role (documentation only)
--
-- `user_role` enum already includes `garage_manager` (migration 014).
-- No ALTER TYPE needed on a fresh install.
--
-- Assign garage_manager to a user by email (run in SQL editor, adjust email):
--
--   UPDATE public.profiles
--   SET user_role = 'garage_manager'::public.user_role
--   WHERE email ILIKE 'manager@yourcompany.com';
--
-- Or by id:
--
--   UPDATE public.profiles
--   SET user_role = 'garage_manager'::public.user_role
--   WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
-- ============================================

COMMENT ON TYPE public.user_role IS
  'Includes garage_manager for garage workflow / capacities / task templates (see migration 014).';
