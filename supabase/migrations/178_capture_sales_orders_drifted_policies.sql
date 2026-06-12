-- ============================================
-- Monza S.A.L. — capture drifted sales_orders policies (2026-06-12)
-- Found live-only (dashboard-created, no migration): the policies that give
-- the plain `sales` role its sales-order access (own-row INSERT, UPDATE) and
-- the owner-only DELETE policy. Captured verbatim so a re-provision from
-- migrations doesn't silently break the sales role. Idempotent.
-- ============================================

DROP POLICY IF EXISTS sales_orders_delete ON public.sales_orders;
CREATE POLICY sales_orders_delete ON public.sales_orders
FOR DELETE
USING (public.is_owner());

DROP POLICY IF EXISTS sales_orders_insert_merged ON public.sales_orders;
CREATE POLICY sales_orders_insert_merged ON public.sales_orders
FOR INSERT
WITH CHECK (
  (SELECT public.is_any_role_resolved(ARRAY['owner'::user_role,'assistant'::user_role,'sales_ops'::user_role]))
  OR (
    ((SELECT public.is_owner()) OR (SELECT public.has_role('sales'::user_role)))
    AND created_by = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS sales_orders_update_merged ON public.sales_orders;
CREATE POLICY sales_orders_update_merged ON public.sales_orders
FOR UPDATE
USING (
  (SELECT public.is_any_role_resolved(ARRAY['owner'::user_role,'assistant'::user_role,'sales_ops'::user_role]))
  OR (SELECT public.has_role('sales'::user_role))
)
WITH CHECK (
  (SELECT public.is_any_role_resolved(ARRAY['owner'::user_role,'assistant'::user_role,'sales_ops'::user_role]))
  OR (SELECT public.has_role('sales'::user_role))
);
