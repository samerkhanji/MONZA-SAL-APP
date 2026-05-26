-- ============================================================================
-- Drop public.profiles.capabilities_jsonb.
--
-- Background
--   profiles carried two capability columns with DIFFERENT vocabularies:
--     - capabilities (user_capability[])        — the source of truth,
--       used by RLS, RPCs, hasCapability() in code, and the
--       profiles_owner_gets_all_capabilities trigger.
--     - capabilities_jsonb (jsonb)              — added in archived
--       migration 025 as a "successor" format. Never adopted: no app
--       code, RLS policy, RPC, view, or constraint reads it. The only
--       reference is the privilege-escalation guard listing it as a
--       protected field.
--
--   Because nothing keeps the two in sync, they drifted: at least one
--   owner (sam@monzasal.com) carried capabilities_jsonb = '{}' while
--   still holding the full text[] capability set. The DB audit (PR #133)
--   flagged this as a silent permission-bug surface.
--
-- Action
--   1. Recreate profiles_block_self_privilege_escalation() without the
--      capabilities_jsonb branch (its other guarded fields are kept).
--   2. Drop the column.
--
-- Applied to prod first via Supabase MCP on 2026-05-26 as
-- 160_drop_profiles_capabilities_jsonb. This file backfills the change
-- into the versioned migrations folder so a fresh `supabase db reset`
-- produces the right schema.
--
-- Investigation report: outputs/capability-schema-consolidation.md
-- ============================================================================

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

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS capabilities_jsonb;
