-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424090837 as `fix_role_helpers_after_role_column_drop`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- profiles.role was dropped in an earlier migration, but four helper functions
-- still read it and get called from many RLS policies. Every SELECT that trips
-- a role-gated policy now fails with `column p.role does not exist`.
-- Fix: rewrite each helper to read only profiles.user_role.

-- 1) is_owner()
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.user_role = 'owner'::public.user_role
  );
$$;

-- 2) has_role(user_role)
CREATE OR REPLACE FUNCTION public.has_role(r public.user_role)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.user_role = r
  );
$$;

-- 3) get_my_user_role() — drop legacy COALESCE
CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.user_role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- 4) get_my_user_role_resolved() — legacy fallback is dead, collapse to user_role
CREATE OR REPLACE FUNCTION public.get_my_user_role_resolved()
RETURNS public.user_role
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.user_role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- Verify none of the four reference p.role anymore
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('is_owner','has_role','get_my_user_role','get_my_user_role_resolved')
       AND pg_get_functiondef(p.oid) LIKE '%.role%'
       AND pg_get_functiondef(p.oid) NOT LIKE '%user_role%'
  LOOP
    RAISE EXCEPTION 'Function % still references p.role', r.proname;
  END LOOP;
END $$;
