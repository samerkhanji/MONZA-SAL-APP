-- Migration 141: enable security_invoker on the remaining definer's-rights
-- views flagged by the Supabase security advisor.
--
-- Migration 101 already revoked anon/PUBLIC SELECT on these views and noted
-- that a follow-up would switch them to security_invoker + role-checked
-- access. Migration 140 did the five report_* views; this completes the set.
--
-- Safety of each conversion:
--   * car_service_status      — its only programmatic consumer is the
--     detect_service_due() function, which is SECURITY DEFINER, so the view
--     still runs with definer rights inside that function. Direct API reads
--     by an authenticated user are now correctly RLS-filtered.
--   * customer_credit_balance — no programmatic or UI consumer; converting
--     it only tightens direct API access.
--   * garage_employee_efficiency — consumed by /garage/efficiency, which is
--     role-gated to owner / garage_manager / hybrid; those roles retain RLS
--     visibility of the underlying garage tables.
--
-- Reversible: `ALTER VIEW ... SET (security_invoker = false);`.

ALTER VIEW public.car_service_status        SET (security_invoker = true);
ALTER VIEW public.customer_credit_balance   SET (security_invoker = true);
ALTER VIEW public.garage_employee_efficiency SET (security_invoker = true);
