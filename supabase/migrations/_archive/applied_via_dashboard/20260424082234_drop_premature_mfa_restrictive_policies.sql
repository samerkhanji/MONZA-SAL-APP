-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424082234 as `drop_premature_mfa_restrictive_policies`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- The earlier RESTRICTIVE MFA policies assumed all users had TOTP enrolled.
-- They don't — so every profile UPDATE fails (password-reset loop) and every
-- cars SELECT returns 0 rows. Drop them. Re-add after MFA is actually enrolled.

DROP POLICY IF EXISTS "cars_require_mfa"          ON public.cars;
DROP POLICY IF EXISTS "profiles_require_mfa_write" ON public.profiles;
