-- ============================================================================
-- Owners always hold every capability.
--
-- The DB-level _require_any_capability() helper already short-circuits for
-- is_owner(), so RPCs never reject an owner. But the UI's hasCapability()
-- helper reads profiles.capabilities directly and does NOT have an owner
-- fallback. That means an owner whose profile is missing, say, the
-- 'inventory' cap would not see the "Add Car" button even though
-- create_car would accept the call.
--
-- This migration:
--   1. Backfills both current owners (Samer + Kareem) to hold every
--      capability in the user_capability enum.
--   2. Adds a BEFORE INSERT/UPDATE trigger on profiles that automatically
--      sets capabilities = full set whenever user_role flips to 'owner'.
--      Removing 'owner' role does NOT strip caps — that's left to the
--      operator to decide explicitly.
--
-- The paired UI change in web/src/lib/permissions.ts makes
-- hasCapability/hasAnyCapability return true for owners regardless of
-- the stored capabilities array, so the invariant holds even if a row
-- drifts.
-- ============================================================================

UPDATE public.profiles
SET capabilities = ARRAY(
  SELECT unnest(enum_range(NULL::user_capability))
)
WHERE user_role = 'owner';

CREATE OR REPLACE FUNCTION public.profiles_owner_gets_all_capabilities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.user_role = 'owner' THEN
    NEW.capabilities := ARRAY(
      SELECT unnest(enum_range(NULL::user_capability))
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_profiles_owner_gets_all_capabilities ON public.profiles;
CREATE TRIGGER trg_profiles_owner_gets_all_capabilities
  BEFORE INSERT OR UPDATE OF user_role, capabilities
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_owner_gets_all_capabilities();

COMMENT ON FUNCTION public.profiles_owner_gets_all_capabilities() IS
  'Owners always hold every capability. Triggered on INSERT or when user_role / capabilities is updated.';
