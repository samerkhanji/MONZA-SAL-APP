-- ============================================
-- MONZA CRM — Fix profiles_block_self_privilege_escalation
-- Migration 057
--
-- Bug
--   The `profiles_block_self_privilege_escalation` trigger (added in
--   `security_hardening_live_20260420`, modified in
--   `drop_profiles_role_v2_20260420`) referenced `NEW.department_id` and
--   `OLD.department_id`. The actual column on public.profiles is
--   `department` (text), with NO `_id` suffix. Every UPDATE on profiles
--   by a non-owner therefore raised 'column "department_id" does not
--   exist' and was rejected.
--
--   Owners are exempt because the trigger early-returns for them, which
--   is why this only manifested for non-owners (Khalil, Lara, Mark,
--   Samaya, Suhail). It blocked:
--     - /api/profile/heartbeat (last_active_at update)
--     - "Mark notification read"
--     - Any self-update from a non-owner.
--
-- Fix
--   Replace NEW.department_id / OLD.department_id with NEW.department /
--   OLD.department. Same intent, correct column name.
--
-- Applied to prod first via Supabase MCP on 2026-04-28 as
-- `fix_profiles_escalation_trigger_department_column` (version
-- 20260428101942). This file backfills the change into the versioned
-- migrations folder so a fresh `supabase db reset` produces the right
-- schema.
-- ============================================

CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT p.user_role INTO caller_role
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
  IF caller_role = 'owner' THEN RETURN NEW; END IF;

  IF (NEW.user_role IS DISTINCT FROM OLD.user_role)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
     OR (NEW.employment_status IS DISTINCT FROM OLD.employment_status)
     OR (NEW.capabilities IS DISTINCT FROM OLD.capabilities)
     OR (NEW.capabilities_jsonb IS DISTINCT FROM OLD.capabilities_jsonb)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (NEW.can_view_owner_requests IS DISTINCT FROM OLD.can_view_owner_requests)
     OR (NEW.is_pipeline_user IS DISTINCT FROM OLD.is_pipeline_user)
     OR (NEW.department IS DISTINCT FROM OLD.department)
  THEN
    RAISE EXCEPTION 'Not authorized to change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
