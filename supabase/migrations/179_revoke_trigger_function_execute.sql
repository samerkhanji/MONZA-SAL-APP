-- ============================================
-- Monza S.A.L. — revoke API-surface EXECUTE on trigger functions (2026-06-12)
-- The Supabase linter flagged the Batch 1-3 trigger functions as callable by
-- anon/authenticated via /rest/v1/rpc (default PUBLIC grant). Direct calls
-- would fail anyway ("trigger functions can only be called as triggers"), but
-- they should not be on the API surface at all. Trigger firing does not
-- require the caller to hold EXECUTE, so this changes no behavior.
-- ============================================

REVOKE ALL ON FUNCTION public.audit_approval_threshold_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_profile_privilege_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cars_block_orphan_reservation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.garage_jobs_return_parts_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_parts_arrived_for_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_orders_sync_car_delivered() FROM PUBLIC, anon, authenticated;
