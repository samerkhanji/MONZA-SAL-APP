-- Migration 140: enable security_invoker on the owner-report views.
--
-- Migration 091 created these five report views and its own header comment
-- described them as "Five SECURITY-INVOKER views, all RLS-protected by the
-- underlying tables". However the CREATE VIEW statements omitted the
-- `security_invoker` setting, so Postgres left them as definer's-rights
-- views that BYPASS row-level security: any authenticated user could read
-- them directly through the REST API regardless of their RLS.
--
-- This migration restores the documented intent. The views now execute with
-- the querying user's permissions and RLS — the reports page is reachable by
-- owner / view_reports / manage_team users, who retain RLS access to the
-- underlying cars / sales_orders / installment_payments / garage_jobs /
-- profiles tables, so the report data is unchanged for them. A user without
-- that access can no longer read the views directly.
--
-- Reversible: `ALTER VIEW ... SET (security_invoker = false);`.

ALTER VIEW public.report_sales_margin          SET (security_invoker = true);
ALTER VIEW public.report_sales_rep_performance SET (security_invoker = true);
ALTER VIEW public.report_inventory_aging       SET (security_invoker = true);
ALTER VIEW public.report_aged_receivables      SET (security_invoker = true);
ALTER VIEW public.report_garage_time_in_state  SET (security_invoker = true);
