-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420141019 as `drop_profiles_role_v2_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Replace the policy that still references profiles.role, then drop the column.

DROP POLICY IF EXISTS "profiles_update_self_or_owner" ON public.profiles;
CREATE POLICY "profiles_update_self_or_owner" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = true
         AND p.user_role = 'owner'::public.user_role
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = true
         AND p.user_role = 'owner'::public.user_role
    )
  );

-- Update the profiles self-escalation trigger so it doesn't reference `role`.
CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT p.user_role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
  IF caller_role = 'owner' THEN RETURN NEW; END IF;

  IF (NEW.user_role IS DISTINCT FROM OLD.user_role)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
     OR (NEW.employment_status IS DISTINCT FROM OLD.employment_status)
     OR (NEW.capabilities IS DISTINCT FROM OLD.capabilities)
     OR (NEW.capabilities_jsonb IS DISTINCT FROM OLD.capabilities_jsonb)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (NEW.can_view_owner_requests IS DISTINCT FROM OLD.can_view_owner_requests)
     OR (NEW.is_pipeline_user IS DISTINCT FROM OLD.is_pipeline_user)
     OR (NEW.department_id IS DISTINCT FROM OLD.department_id)
  THEN
    RAISE EXCEPTION 'Not authorized to change privileged profile fields' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop any other lingering objects referencing profiles.role
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname='public'
       AND (qual LIKE '%profiles.role%' OR with_check LIKE '%profiles.role%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Finally drop.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
