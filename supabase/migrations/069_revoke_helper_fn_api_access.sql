-- Revoke EXECUTE on role-check / helper SECURITY DEFINER functions from
-- authenticated and anon. RLS policies execute as the postgres role and
-- continue to call these helpers — they only lose their REST exposure
-- via /rest/v1/rpc/<name>.
--
-- Addresses 10 of the 19 advisor warnings under
-- authenticated_security_definer_function_executable.

REVOKE EXECUTE ON FUNCTION public.is_owner()                             FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_role(p_role public.user_role)       FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(r public.user_role)           FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_any_role(p_roles public.user_role[])         FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_any_role_resolved(allowed_roles public.user_role[]) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_user_role()                     FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_user_role_resolved()            FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pipeline_user()                     FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_owner_requests()              FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cars_phase3_can_edit_monza_warranty()  FROM authenticated, anon, PUBLIC;
