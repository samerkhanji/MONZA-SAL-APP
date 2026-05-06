-- Rewrite 11 RLS policies so calls to auth.uid() are wrapped in
-- (select auth.uid()). Postgres caches the SELECT result once per
-- query instead of re-evaluating per row. Logic is unchanged.
--
-- Addresses 11 advisor warnings under auth_rls_initplan
-- (lint 0003_auth_rls_initplan).

-- appointments
ALTER POLICY appointments_insert ON public.appointments
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY appointments_update ON public.appointments
  USING (
    is_owner()
    OR (assigned_to = (select auth.uid()))
    OR (created_by = (select auth.uid()))
  );

-- commissions
ALTER POLICY commissions_select ON public.commissions
  USING (
    is_owner()
    OR (beneficiary_profile_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.capabilities && ARRAY['view_reports'::user_capability, 'cashier'::user_capability]
    )
  );

-- customer_interactions
ALTER POLICY customer_interactions_insert ON public.customer_interactions
  WITH CHECK (
    is_owner()
    OR (
      ((select auth.uid()) IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (select auth.uid())
          AND p.capabilities && ARRAY['sales'::user_capability, 'garage'::user_capability]
      )
    )
  );

ALTER POLICY customer_interactions_update_creator ON public.customer_interactions
  USING (
    is_owner()
    OR (created_by = (select auth.uid()))
  );

-- invoices
ALTER POLICY invoices_insert ON public.invoices
  WITH CHECK (
    is_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.capabilities && ARRAY['sales'::user_capability, 'cashier'::user_capability]
    )
  );

ALTER POLICY invoices_update ON public.invoices
  USING (
    is_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.capabilities && ARRAY['sales'::user_capability, 'cashier'::user_capability]
    )
  );

-- suppliers
ALTER POLICY suppliers_insert ON public.suppliers
  WITH CHECK (
    is_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.capabilities && ARRAY['inventory'::user_capability, 'garage'::user_capability]
    )
  );

ALTER POLICY suppliers_update ON public.suppliers
  USING (
    is_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.capabilities && ARRAY['inventory'::user_capability, 'garage'::user_capability]
    )
  );

-- tasks
ALTER POLICY tasks_insert_authenticated ON public.tasks
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY tasks_update_assignee_or_creator ON public.tasks
  USING (
    is_owner()
    OR (assigned_to_user_id = (select auth.uid()))
    OR (created_by_user_id = (select auth.uid()))
  );
