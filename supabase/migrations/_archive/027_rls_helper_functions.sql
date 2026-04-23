-- ============================================
-- MONZA CRM - RLS helper functions (SECURITY DEFINER)
-- Migration 027: stable role checks for policies
--
-- Why: migration 016 references public.is_role / public.is_any_role but they
-- were not in-repo; policies need a single place to read profiles.user_role
-- without recursive RLS issues if profiles SELECT is ever tightened.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_user_role() IS
  'Returns profiles.user_role for JWT user; SECURITY DEFINER; used in RLS.';

CREATE OR REPLACE FUNCTION public.is_role(p_role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_user_role() IS NOT DISTINCT FROM p_role;
$$;

COMMENT ON FUNCTION public.is_role(public.user_role) IS
  'True when current user profile user_role equals p_role enum value.';

CREATE OR REPLACE FUNCTION public.is_any_role(p_roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_user_role() = ANY(p_roles), false);
$$;

COMMENT ON FUNCTION public.is_any_role(public.user_role[]) IS
  'True when current user user_role is in p_roles (false if role null).';

-- Optional: legacy profiles.role fallback when user_role is null (bootstrap safety)
CREATE OR REPLACE FUNCTION public.get_my_user_role_resolved()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ur public.user_role;
  legacy text;
BEGIN
  SELECT p.user_role, p.role::text
  INTO ur, legacy
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF ur IS NOT NULL THEN
    RETURN ur;
  END IF;

  -- Map legacy role column to user_role enum where possible
  IF legacy = 'owner' THEN RETURN 'owner'::public.user_role; END IF;
  IF legacy = 'assistant' THEN RETURN 'assistant'::public.user_role; END IF;
  IF legacy = 'garage_manager' THEN RETURN 'garage_manager'::public.user_role; END IF;
  IF legacy = 'sales' THEN RETURN 'sales_ops'::public.user_role; END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_any_role_resolved(allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_user_role_resolved() = ANY(allowed_roles), false);
$$;

REVOKE ALL ON FUNCTION public.get_my_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_role(public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_role(public.user_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_any_role(public.user_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_any_role(public.user_role[]) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_user_role_resolved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_user_role_resolved() TO authenticated;

REVOKE ALL ON FUNCTION public.is_any_role_resolved(public.user_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_any_role_resolved(public.user_role[]) TO authenticated;
