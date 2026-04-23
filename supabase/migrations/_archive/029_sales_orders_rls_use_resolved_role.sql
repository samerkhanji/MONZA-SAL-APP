-- ============================================
-- MONZA CRM — sales_orders RLS: use is_any_role_resolved
-- Migration 029
--
-- If migration 028 was already applied with public.is_any_role(), replace write
-- policies so legacy profiles.role maps correctly when user_role is null.
-- Safe to run on fresh DBs (idempotent policy names).
-- Prerequisite: 027_rls_helper_functions.sql
-- ============================================

DROP POLICY IF EXISTS "sales_orders_insert_sales_roles" ON public.sales_orders;
CREATE POLICY "sales_orders_insert_sales_roles"
  ON public.sales_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "sales_orders_update_sales_roles" ON public.sales_orders;
CREATE POLICY "sales_orders_update_sales_roles"
  ON public.sales_orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'sales_ops']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'sales_ops']::public.user_role[]
    )
  );

-- SELECT policy unchanged; UPDATE requires SELECT visibility under PostgREST — already USING (true).
