-- Migration 052: Backend Security Hardening
--
-- Addresses findings from the harsh backend audit:
--   H1: block self-escalation of profiles security fields via trigger
--   H4: restore request_attachments ownership predicate dropped in 051
--   H5: replace legacy `role = 'owner'` RLS with is_any_role_resolved
--   H6: harden SECURITY DEFINER functions with SET search_path

-- ─────────────────────────────────────────────────────────────
-- H1. Trigger: profiles_block_self_privilege_escalation
--   profiles_update_own in migration 025 lets users update any of
--   their own columns — including user_role, role, is_active,
--   employment_status, capabilities, capabilities_jsonb. This is a
--   one-PATCH owner takeover.
--
--   We block these column changes unless the *caller* is already
--   an owner. Owners editing themselves still works; anyone else
--   editing non-privileged fields (phone, avatar, etc.) still works.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role public.user_role;
  caller_legacy text;
BEGIN
  -- No UID (service role / trigger during signup) → allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve caller's effective role.
  SELECT p.user_role, p.role::text
  INTO caller_role, caller_legacy
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  -- Owners can change anything.
  IF caller_role = 'owner' OR caller_legacy = 'owner' THEN
    RETURN NEW;
  END IF;

  -- Non-owners: block any change to security-sensitive fields.
  IF (NEW.user_role IS DISTINCT FROM OLD.user_role)
     OR (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
     OR (NEW.employment_status IS DISTINCT FROM OLD.employment_status)
     OR (NEW.capabilities IS DISTINCT FROM OLD.capabilities)
     OR (NEW.capabilities_jsonb IS DISTINCT FROM OLD.capabilities_jsonb)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
  THEN
    RAISE EXCEPTION 'Not authorized to change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER profiles_block_self_privilege_escalation_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();

-- ─────────────────────────────────────────────────────────────
-- H4. Restore request_attachments ownership predicate.
--   Migration 051 dropped the check that the request belongs to
--   the caller. Restore the compound predicate.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "request_attachments_insert_own" ON public.request_attachments;

CREATE POLICY "request_attachments_insert_own"
  ON public.request_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_attachments.request_id
        AND (
          r.submitted_by = auth.uid()
          OR r.assigned_to = auth.uid()
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- H5. Replace legacy `role = 'owner'` RLS with is_any_role_resolved.
--   Legacy text `role` column is self-updatable (blocked now by
--   H1, but belt-and-suspenders: use the resolved helper instead).
-- ─────────────────────────────────────────────────────────────

-- 5a. document_access_requests (migration 006)
DROP POLICY IF EXISTS "Users see own document requests" ON public.document_access_requests;
CREATE POLICY "Users see own document requests" ON public.document_access_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

DROP POLICY IF EXISTS "Owners update document requests" ON public.document_access_requests;
CREATE POLICY "Owners update document requests" ON public.document_access_requests
  FOR UPDATE TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));

-- 5b. page_access_requests (migration 006)
DROP POLICY IF EXISTS "Users see own page requests" ON public.page_access_requests;
CREATE POLICY "Users see own page requests" ON public.page_access_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

DROP POLICY IF EXISTS "Owners update page requests" ON public.page_access_requests;
CREATE POLICY "Owners update page requests" ON public.page_access_requests
  FOR UPDATE TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));

-- 5c. delete_requests (migration 007)
DROP POLICY IF EXISTS "delete_requests_select" ON public.delete_requests;
CREATE POLICY "delete_requests_select" ON public.delete_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

DROP POLICY IF EXISTS "delete_requests_update" ON public.delete_requests;
CREATE POLICY "delete_requests_update" ON public.delete_requests
  FOR UPDATE TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));

DROP POLICY IF EXISTS "delete_requests_delete" ON public.delete_requests;
CREATE POLICY "delete_requests_delete" ON public.delete_requests
  FOR DELETE TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));

-- 5d. requests_update (migration 003)
DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

-- ─────────────────────────────────────────────────────────────
-- H6. Harden legacy SECURITY DEFINER functions with SET search_path.
--   move_car / create_car in migration 001 rely on an in-body
--   `PERFORM set_config(...)` which is best-effort; prefer the
--   function-attribute form used in migrations 024–040.
-- ─────────────────────────────────────────────────────────────

ALTER FUNCTION public.move_car(
  uuid, public.location_type, text, public.car_status, text, uuid
) SET search_path = public, pg_temp;

ALTER FUNCTION public.create_car(
  text, text, text, integer, text, text,
  public.location_type, text, public.car_status, uuid
) SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.profiles_block_self_privilege_escalation() IS
  'Defense-in-depth trigger: prevents non-owner authenticated users from updating privileged profile fields (user_role, role, is_active, employment_status, capabilities, capabilities_jsonb, created_by) via direct PostgREST UPDATE.';
