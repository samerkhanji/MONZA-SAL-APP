-- ============================================
-- MONZA CRM — Resolved-role RLS normalization
-- Migration 052
--
-- Purpose
--   Older RLS on installments, garage bays / time / repair proposals,
--   and system_events / infrastructure_compute_target still read
--   `profiles.user_role` directly (either via `public.is_any_role()` /
--   `public.is_role()` or via inline `EXISTS (... WHERE user_role = 'owner')`).
--   A legacy user with `profiles.role = 'owner'` but a NULL `profiles.user_role`
--   would silently be denied, even though the app's `getAppRoleFromProfile()`
--   helper in web/src/lib/permissions.ts treats them as owner.
--
--   This migration rewires those policies to the resolved-role helpers added
--   in 027:
--     public.is_any_role_resolved(roles[])
--     public.get_my_user_role_resolved()
--
--   Same pattern as migration 029 (sales_orders). Additive, policy-only,
--   idempotent. No schema or data mutation.
--
-- Prerequisites
--   - 014_rbac_user_roles_and_requests.sql (user_role enum)
--   - 027_rls_helper_functions.sql  (is_any_role_resolved, get_my_user_role_resolved)
--   - 029_sales_orders_rls_use_resolved_role.sql (reference)
--
-- Constraints
--   - No ALTER TABLE … DISABLE RLS.
--   - Policy names are preserved so downstream queries / tooling keep working.
--   - Role coverage is byte-for-byte identical to the original policies.
-- ============================================

-- ============================================================
-- 1. installments / payment_plans  (from migration 016)
-- ============================================================

-- payment_plans -------------------------------------------------
DROP POLICY IF EXISTS "plans_select_all_roles" ON public.payment_plans;
CREATE POLICY "plans_select_all_roles"
  ON public.payment_plans
  FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "plans_insert_owner_assistant_sales" ON public.payment_plans;
CREATE POLICY "plans_insert_owner_assistant_sales"
  ON public.payment_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "plans_update_owner_assistant" ON public.payment_plans;
CREATE POLICY "plans_update_owner_assistant"
  ON public.payment_plans
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "plans_delete_owner_only" ON public.payment_plans;
CREATE POLICY "plans_delete_owner_only"
  ON public.payment_plans
  FOR DELETE
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  );

-- installment_payments ------------------------------------------
DROP POLICY IF EXISTS "installments_select_all_roles" ON public.installment_payments;
CREATE POLICY "installments_select_all_roles"
  ON public.installment_payments
  FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "installments_insert_owner_assistant_sales" ON public.installment_payments;
CREATE POLICY "installments_insert_owner_assistant_sales"
  ON public.installment_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "payments_delete_owner_only" ON public.installment_payments;
CREATE POLICY "payments_delete_owner_only"
  ON public.installment_payments
  FOR DELETE
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  );

-- ============================================================
-- 2. garage_bays / job_time_entries / garage_job_bay_context /
--    repair_proposals / repair_proposal_items (from migration 037)
-- ============================================================

-- garage_bays ---------------------------------------------------
DROP POLICY IF EXISTS "garage_bays_insert_mgr" ON public.garage_bays;
CREATE POLICY "garage_bays_insert_mgr"
  ON public.garage_bays
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "garage_bays_update_mgr" ON public.garage_bays;
CREATE POLICY "garage_bays_update_mgr"
  ON public.garage_bays
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );
-- garage_bays_select_auth (from 037) has no role check — leave untouched.

-- job_time_entries ----------------------------------------------
DROP POLICY IF EXISTS "job_time_entries_select" ON public.job_time_entries;
CREATE POLICY "job_time_entries_select"
  ON public.job_time_entries
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.is_any_role_resolved(
      ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "job_time_entries_insert" ON public.job_time_entries;
CREATE POLICY "job_time_entries_insert"
  ON public.job_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.is_any_role_resolved(
      ARRAY['owner','garage_manager','garage_staff']::public.user_role[]
    )
  );

-- job_time_entries_update (from 037) is intentionally narrow (employee_id = auth.uid()).
-- No user_role reference there — leave untouched.

-- garage_job_bay_context ----------------------------------------
DROP POLICY IF EXISTS "garage_job_bay_context_select" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_select"
  ON public.garage_job_bay_context
  FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "garage_job_bay_context_insert" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_insert"
  ON public.garage_job_bay_context
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "garage_job_bay_context_update" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_update"
  ON public.garage_job_bay_context
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  );

-- repair_proposals ----------------------------------------------
DROP POLICY IF EXISTS "repair_proposals_select" ON public.repair_proposals;
CREATE POLICY "repair_proposals_select"
  ON public.repair_proposals
  FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "repair_proposals_insert" ON public.repair_proposals;
CREATE POLICY "repair_proposals_insert"
  ON public.repair_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "repair_proposals_update_gm" ON public.repair_proposals;
CREATE POLICY "repair_proposals_update_gm"
  ON public.repair_proposals
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','garage_manager']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "repair_proposals_update_asst" ON public.repair_proposals;
CREATE POLICY "repair_proposals_update_asst"
  ON public.repair_proposals
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'assistant'::public.user_role
  )
  WITH CHECK (
    public.get_my_user_role_resolved() = 'assistant'::public.user_role
  );

-- repair_proposal_items -----------------------------------------
DROP POLICY IF EXISTS "repair_proposal_items_select" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_select"
  ON public.repair_proposal_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_insert" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_insert"
  ON public.repair_proposal_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.is_any_role_resolved(
              ARRAY['owner','garage_manager']::public.user_role[]
            )
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_update_gm" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_update_gm"
  ON public.repair_proposal_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.is_any_role_resolved(
              ARRAY['owner','garage_manager']::public.user_role[]
            )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.is_any_role_resolved(
              ARRAY['owner','garage_manager']::public.user_role[]
            )
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_update_asst" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_update_asst"
  ON public.repair_proposal_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.get_my_user_role_resolved() = 'assistant'::public.user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.get_my_user_role_resolved() = 'assistant'::public.user_role
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_delete" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_delete"
  ON public.repair_proposal_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.repair_proposals rp
      WHERE rp.id = proposal_id
        AND public.is_any_role_resolved(
              ARRAY['owner','garage_manager']::public.user_role[]
            )
    )
  );

-- ============================================================
-- 3. system_events + infrastructure_compute_target (from migration 050)
--    These used inline  EXISTS (SELECT 1 FROM profiles p
--                               WHERE p.id = auth.uid()
--                                 AND p.user_role = 'owner')
--    which fails for legacy `profiles.role='owner'` users with a null user_role.
-- ============================================================

DROP POLICY IF EXISTS "system_events_select_owner" ON public.system_events;
CREATE POLICY "system_events_select_owner"
  ON public.system_events
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  );

DROP POLICY IF EXISTS "infrastructure_compute_target_select_owner"
  ON public.infrastructure_compute_target;
CREATE POLICY "infrastructure_compute_target_select_owner"
  ON public.infrastructure_compute_target
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  );

DROP POLICY IF EXISTS "infrastructure_compute_target_update_owner"
  ON public.infrastructure_compute_target;
CREATE POLICY "infrastructure_compute_target_update_owner"
  ON public.infrastructure_compute_target
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  )
  WITH CHECK (
    public.get_my_user_role_resolved() = 'owner'::public.user_role
  );
