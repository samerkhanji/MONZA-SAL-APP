-- HOT-FIX: restore EXECUTE on RLS helper functions for the authenticated role.
--
-- Migration 068 (revoke REST execute from internal/trigger SECURITY DEFINER
-- functions) was too aggressive: it revoked EXECUTE on the helper functions
-- that RLS policies CALL during query evaluation. With no EXECUTE grant,
-- every SELECT that hits a policy referencing one of these functions errors
-- with "permission denied for function ...", which breaks the entire owner
-- dashboard.
--
-- These functions are SECURITY DEFINER and run with elevated privilege; the
-- safe contract is "authenticated may call them, anon may not." We restore
-- EXECUTE to authenticated and ensure anon stays revoked.

GRANT EXECUTE ON FUNCTION public.is_owner()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_role(user_role[])          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_role_resolved(user_role[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_owner()                        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_any_role(user_role[])          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_any_role_resolved(user_role[]) FROM anon, PUBLIC;

-- has_capability was also touched but it kept its grants; tighten anon while we're here.
REVOKE EXECUTE ON FUNCTION public.has_capability(user_capability) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_capability(user_capability) TO authenticated;
