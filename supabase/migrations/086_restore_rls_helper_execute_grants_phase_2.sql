-- HOT-FIX phase 2: migration 085 fixed is_owner / is_any_role(_resolved) /
-- has_capability, but missed the rest of the helper family. RLS policies on
-- garage tables / settings / accessories call get_my_user_role_resolved,
-- has_role(), is_role(), can_view_owner_requests, is_pipeline_user — all of
-- which were revoked. That's why Owner Overview, Garage Task Board, Garage
-- Inventory, Workflow Setup, and Settings all return "permission denied for
-- function get_my_user_role_resolved" / Forbidden.
--
-- Trigger functions don't need EXECUTE granted to users (triggers don't
-- check EXECUTE), and cron-only functions are called by the postgres role.
-- We grant only the helpers that RLS policies / user-callable RPCs evaluate.

GRANT EXECUTE ON FUNCTION public.get_my_user_role()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_role_resolved()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_role(user_role)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pipeline_user()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_owner_requests()       TO authenticated;
GRANT EXECUTE ON FUNCTION public._require_any_capability(user_capability[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_user_role()              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_user_role_resolved()     FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(user_role)             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_role(user_role)              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pipeline_user()              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_owner_requests()       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._require_any_capability(user_capability[]) FROM anon, PUBLIC;
