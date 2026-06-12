-- ============================================
-- Monza S.A.L. — grant the hybrid role access to sales orders (2026-06-12)
-- Khalil (hybrid) works sales and should see/manage sales orders. The SELECT
-- (mig 167) and INSERT/UPDATE (mig 029) policies gated on owner/assistant/
-- sales_ops only. Re-create all three adding hybrid + khalil_hybrid, preserving
-- the existing soft-delete guard on SELECT. Idempotent.
-- ============================================

DROP POLICY IF EXISTS sales_orders_select_sales_roles ON public.sales_orders;
CREATE POLICY sales_orders_select_sales_roles ON public.sales_orders
FOR SELECT
USING (
  (deleted_at IS NULL OR public.is_owner())
  AND public.is_any_role_resolved(
    ARRAY['owner','assistant','sales_ops','hybrid','khalil_hybrid']::public.user_role[]
  )
);

DROP POLICY IF EXISTS "sales_orders_insert_sales_roles" ON public.sales_orders;
CREATE POLICY "sales_orders_insert_sales_roles" ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_any_role_resolved(
    ARRAY['owner','assistant','sales_ops','hybrid','khalil_hybrid']::public.user_role[]
  )
);

DROP POLICY IF EXISTS "sales_orders_update_sales_roles" ON public.sales_orders;
CREATE POLICY "sales_orders_update_sales_roles" ON public.sales_orders
FOR UPDATE
TO authenticated
USING (
  public.is_any_role_resolved(
    ARRAY['owner','assistant','sales_ops','hybrid','khalil_hybrid']::public.user_role[]
  )
)
WITH CHECK (
  public.is_any_role_resolved(
    ARRAY['owner','assistant','sales_ops','hybrid','khalil_hybrid']::public.user_role[]
  )
);
