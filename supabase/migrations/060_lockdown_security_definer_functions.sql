-- ============================================
-- MONZA CRM — Lock down SECURITY DEFINER functions exposed to anon
-- Migration 060
--
-- Supabase Security Advisor flagged 29 SECURITY DEFINER functions in
-- public schema as callable by `anon` (anonymous) via PostgREST RPC.
-- This migration:
--   1. REVOKEs EXECUTE FROM PUBLIC (which includes anon) on ALL 29
--   2. For trigger-only functions, also REVOKE FROM authenticated
--   3. For RLS helpers + application RPCs, GRANT EXECUTE TO authenticated
--
-- Applied to prod via MCP on 2026-04-29 as
-- `lockdown_security_definer_functions`. Anon-execute warnings dropped
-- 29 -> 0; authenticated warnings (21) remain by design.
-- ============================================

-- ============================================
-- 1. Trigger-only functions: REVOKE from everyone except postgres.
-- ============================================

REVOKE ALL ON FUNCTION public.advance_lead_on_test_drive_return() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_car_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_block_self_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_job_actual_hours() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_car_status_from_sale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email_on_auth_update() FROM PUBLIC, anon, authenticated;

-- ============================================
-- 2. RLS helper functions: REVOKE from PUBLIC/anon, GRANT to authenticated.
-- ============================================

REVOKE ALL ON FUNCTION public.can_view_owner_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_owner_requests() TO authenticated;

REVOKE ALL ON FUNCTION public.cars_phase3_can_edit_monza_warranty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cars_phase3_can_edit_monza_warranty() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_user_role_resolved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_user_role_resolved() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.user_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_any_role(public.user_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_any_role(public.user_role[]) TO authenticated;

REVOKE ALL ON FUNCTION public.is_any_role_resolved(public.user_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_any_role_resolved(public.user_role[]) TO authenticated;

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

REVOKE ALL ON FUNCTION public.is_pipeline_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pipeline_user() TO authenticated;

REVOKE ALL ON FUNCTION public.is_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_role(public.user_role) TO authenticated;

-- ============================================
-- 3. Application RPCs: REVOKE from PUBLIC/anon, GRANT to authenticated.
-- ============================================

REVOKE ALL ON FUNCTION public.apply_part_to_job(uuid, uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_part_to_job(uuid, uuid, integer, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.attach_job_to_bay(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_job_to_bay(uuid, integer, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_delivery(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_car(text, text, text, integer, text, text, public.location_type, text, public.car_status, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_car(text, text, text, integer, text, text, public.location_type, text, public.car_status, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_task_from_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_task_from_request(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.move_car(uuid, public.location_type, text, public.car_status, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_car(uuid, public.location_type, text, public.car_status, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.receive_shipped_car_by_vin(text, public.location_type, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_shipped_car_by_vin(text, public.location_type, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.release_bay(integer, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_bay(integer, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.return_part_from_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_part_from_job(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.scan_vin_to_bay(text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_vin_to_bay(text, integer, uuid) TO authenticated;
