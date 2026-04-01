-- ============================================
-- MONZA CRM — sales_orders RLS + index
-- Migration 028
--
-- Prerequisite: 027_rls_helper_functions.sql (public.is_any_role_resolved)
--
-- Schema note: reservation_date, delivery_date, reserved_by on public.sales_orders
-- are defined in 019_sales_orders_reservation_and_cars_display_links.sql.
-- Canonical dates for a vehicle are edited on sales_orders, not on public.cars.
-- ============================================

-- Helpful for “latest non-cancelled order per car” queries (vehicle page, cars_display)
CREATE INDEX IF NOT EXISTS idx_sales_orders_car_id_created_at
  ON public.sales_orders (car_id, created_at DESC);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user (matches historical openness of inventory UIs)
DROP POLICY IF EXISTS "sales_orders_select_authenticated" ON public.sales_orders;
CREATE POLICY "sales_orders_select_authenticated"
  ON public.sales_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- Write: roles that create/update sales in-app (inventory + installments flows)
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

-- No DELETE policy: authenticated users cannot hard-delete sales_orders via PostgREST
-- (use service role / SQL if ever required).
