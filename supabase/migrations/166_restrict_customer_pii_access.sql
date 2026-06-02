-- Per launch security audit decision 1: the prior customers_select_all
-- policy gave every authenticated employee read access to all customer
-- PII (phone, email, addresses, IDs, payment history) with no role gate.
--
-- Replace with a single permissive policy that gates SELECT by role:
--   - owner, sales, sales_ops, hybrid, khalil_hybrid, assistant: full read
--   - garage_manager: only customers whose car has had a garage job
--     (joined via sales_orders bridge)
--   - garage_staff, it: NO customer PII access at all
--
-- Single permissive policy (vs multiple) avoids the
-- multiple_permissive_policies advisor warning fixed in migration 164.

DROP POLICY IF EXISTS customers_select_all ON public.customers;

CREATE POLICY customers_select_by_role ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      is_owner()
      OR has_role('sales'::user_role)
      OR has_role('sales_ops'::user_role)
      OR has_role('hybrid'::user_role)
      OR has_role('khalil_hybrid'::user_role)
      OR has_role('assistant'::user_role)
      OR (
        has_role('garage_manager'::user_role)
        AND EXISTS (
          SELECT 1
          FROM public.sales_orders so
          JOIN public.garage_jobs gj ON gj.car_id = so.car_id
          WHERE so.customer_id = customers.id
        )
      )
    )
  );

-- TODO follow-up: column-level restrictions for assistant (limit to
-- non-sensitive columns) and a payment-only view for accounting. These
-- require dedicated views since RLS is row-level only.
