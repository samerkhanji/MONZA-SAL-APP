-- Migration 146: tighten SECURITY DEFINER function exposure.
--
-- The Supabase security advisor flagged two genuinely actionable issues.
--
-- 1) Eleven trigger functions are SECURITY DEFINER and still carry an
--    EXECUTE grant to anon / authenticated, so they are reachable as RPCs
--    via /rest/v1/rpc/. Trigger functions fire automatically from table
--    triggers (with the trigger owner's rights) and never need an EXECUTE
--    grant — revoking it removes them from the REST API with ZERO change
--    to trigger behaviour.
--
-- 2) Four functions have a role-mutable search_path. Pinning search_path
--    stops a caller from shadowing built-in objects to hijack them.
--
-- NOT CHANGED (intentional): the advisor also lists ~50 SECURITY DEFINER
-- *RPCs* (create_car, approve_purchase_order, open_cash_session, …) as
-- authenticated-executable. Those are the application's intended API
-- surface — each performs its own is_owner()/has_capability() check
-- internally — and MUST stay executable by authenticated. Revoking them
-- would break the app, so they are deliberately left as-is.

-- ============================================================================
-- 1) Remove trigger functions from the REST RPC surface.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION
  public.block_last_owner_self_demote(),
  public.cars_auto_create_garage_job(),
  public.cash_movements_lock_closed_session(),
  public.cash_sessions_lock_close_fields(),
  public.garage_jobs_sync_car_location(),
  public.installment_payment_to_cash_movement(),
  public.po_payment_to_cash_movement(),
  public.profiles_owner_gets_all_capabilities(),
  public.refund_payment_to_cash_movement(),
  public.sales_order_deposit_to_cash_movement(),
  public.tg_repair_proposal_owner_approval_notif()
FROM anon, authenticated, PUBLIC;

-- ============================================================================
-- 2) Pin search_path on the flagged functions (project standard).
-- ============================================================================
ALTER FUNCTION public.generate_po_number()             SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.normalize_phone(text)            SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.notifications_sync_is_read()      SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.invoices_check_paid_transition() SET search_path TO 'public', 'pg_temp';
