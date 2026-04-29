-- ============================================
-- MONZA CRM — Tighten policy roles + add missing FK indexes
-- Migration 061
--
-- Applied to prod via MCP on 2026-04-29 as
-- `tighten_policy_roles_and_add_fk_indexes`.
--
-- Two cleanups bundled:
--   1. 20 RLS policies on public.{accessory_*, car_warranties,
--      garage_job_bay_context, garage_tasks,
--      infrastructure_compute_target, page_access_requests, profiles,
--      requests, task_timers} were granted to `{public}` role on write
--      commands. Inner USING/CHECK already check auth.uid(), but the
--      role grant should be `authenticated` for defense in depth. This
--      DROPs + recreates each policy with `TO authenticated`.
--   2. Adds 20 covering indexes for foreign keys flagged by Supabase
--      Performance Advisor as unindexed.
-- ============================================

-- ============================================
-- 1. Tighten {public} -> {authenticated} on write policies.
-- ============================================

-- accessory_custom_items
DROP POLICY IF EXISTS acc_custom_items_insert ON public.accessory_custom_items;
CREATE POLICY acc_custom_items_insert ON public.accessory_custom_items
  FOR INSERT TO authenticated
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

DROP POLICY IF EXISTS acc_custom_items_update ON public.accessory_custom_items;
CREATE POLICY acc_custom_items_update ON public.accessory_custom_items
  FOR UPDATE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

DROP POLICY IF EXISTS acc_custom_items_delete ON public.accessory_custom_items;
CREATE POLICY acc_custom_items_delete ON public.accessory_custom_items
  FOR DELETE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

-- accessory_custom_tables
DROP POLICY IF EXISTS acc_custom_tables_insert ON public.accessory_custom_tables;
CREATE POLICY acc_custom_tables_insert ON public.accessory_custom_tables
  FOR INSERT TO authenticated
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

DROP POLICY IF EXISTS acc_custom_tables_update ON public.accessory_custom_tables;
CREATE POLICY acc_custom_tables_update ON public.accessory_custom_tables
  FOR UPDATE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

DROP POLICY IF EXISTS acc_custom_tables_delete ON public.accessory_custom_tables;
CREATE POLICY acc_custom_tables_delete ON public.accessory_custom_tables
  FOR DELETE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::user_role[]));

-- car_warranties
DROP POLICY IF EXISTS car_warranties_insert ON public.car_warranties;
CREATE POLICY car_warranties_insert ON public.car_warranties
  FOR INSERT TO authenticated
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','hybrid']::user_role[]));

DROP POLICY IF EXISTS car_warranties_update ON public.car_warranties;
CREATE POLICY car_warranties_update ON public.car_warranties
  FOR UPDATE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','hybrid']::user_role[]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner','assistant','hybrid']::user_role[]));

DROP POLICY IF EXISTS car_warranties_delete ON public.car_warranties;
CREATE POLICY car_warranties_delete ON public.car_warranties
  FOR DELETE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','assistant','hybrid']::user_role[]));

-- garage_job_bay_context
DROP POLICY IF EXISTS gjbc_insert_garage ON public.garage_job_bay_context;
CREATE POLICY gjbc_insert_garage ON public.garage_job_bay_context
  FOR INSERT TO authenticated
  WITH CHECK (is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::user_role[]));

DROP POLICY IF EXISTS gjbc_update_garage ON public.garage_job_bay_context;
CREATE POLICY gjbc_update_garage ON public.garage_job_bay_context
  FOR UPDATE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::user_role[]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::user_role[]));

DROP POLICY IF EXISTS gjbc_delete_garage ON public.garage_job_bay_context;
CREATE POLICY gjbc_delete_garage ON public.garage_job_bay_context
  FOR DELETE TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::user_role[]));

-- garage_tasks
DROP POLICY IF EXISTS garage_tasks_update ON public.garage_tasks;
CREATE POLICY garage_tasks_update ON public.garage_tasks
  FOR UPDATE TO authenticated
  USING (
    is_any_role_resolved(ARRAY['owner','garage_manager']::user_role[])
    OR (get_my_user_role_resolved() = 'garage_staff'::user_role AND assigned_to = (SELECT auth.uid()))
  )
  WITH CHECK (
    is_any_role_resolved(ARRAY['owner','garage_manager']::user_role[])
    OR (get_my_user_role_resolved() = 'garage_staff'::user_role AND assigned_to = (SELECT auth.uid()))
  );

-- infrastructure_compute_target
DROP POLICY IF EXISTS infrastructure_compute_target_update_owner ON public.infrastructure_compute_target;
CREATE POLICY infrastructure_compute_target_update_owner ON public.infrastructure_compute_target
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.user_role = 'owner'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.user_role = 'owner'::user_role));

-- page_access_requests
DROP POLICY IF EXISTS page_access_insert_own ON public.page_access_requests;
CREATE POLICY page_access_insert_own ON public.page_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = (SELECT auth.uid()));

-- profiles_update_self_or_owner
DROP POLICY IF EXISTS profiles_update_self_or_owner ON public.profiles;
CREATE POLICY profiles_update_self_or_owner ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_active = true AND p.user_role = 'owner'::user_role))
  WITH CHECK (id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_active = true AND p.user_role = 'owner'::user_role));

-- requests
DROP POLICY IF EXISTS requests_insert_own ON public.requests;
CREATE POLICY requests_insert_own ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS requests_update_owner_or_party ON public.requests;
CREATE POLICY requests_update_owner_or_party ON public.requests
  FOR UPDATE TO authenticated
  USING (submitted_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()) OR reviewed_by = (SELECT auth.uid()) OR is_any_role_resolved(ARRAY['owner'::user_role]))
  WITH CHECK (submitted_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()) OR reviewed_by = (SELECT auth.uid()) OR is_any_role_resolved(ARRAY['owner'::user_role]));

-- task_timers
DROP POLICY IF EXISTS task_timers_insert_own ON public.task_timers;
CREATE POLICY task_timers_insert_own ON public.task_timers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS task_timers_update_own ON public.task_timers;
CREATE POLICY task_timers_update_own ON public.task_timers
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 2. Add 20 missing covering indexes for foreign keys.
-- ============================================

CREATE INDEX IF NOT EXISTS idx_acc_custom_items_table_id            ON public.accessory_custom_items(table_id);
CREATE INDEX IF NOT EXISTS idx_bay_assignment_history_bay_id        ON public.bay_assignment_history(bay_id);
CREATE INDEX IF NOT EXISTS idx_bay_assignment_history_car_id        ON public.bay_assignment_history(car_id);
CREATE INDEX IF NOT EXISTS idx_garage_capacities_updated_by_v2      ON public.garage_capacities(updated_by);
CREATE INDEX IF NOT EXISTS idx_garage_jobs_customer_id              ON public.garage_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_garage_task_template_items_template_id_v2 ON public.garage_task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_garage_task_templates_created_by_v2  ON public.garage_task_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_assigned_to_v2          ON public.garage_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_car_id_v2               ON public.garage_tasks(car_id);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_created_by_v2           ON public.garage_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_template_item_id_v2     ON public.garage_tasks(template_item_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_compute_target_updated_by ON public.infrastructure_compute_target(updated_by);
CREATE INDEX IF NOT EXISTS idx_payment_plans_car_id                 ON public.payment_plans(car_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_customer_id            ON public.payment_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id           ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_repair_proposal_items_proposal_id    ON public.repair_proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_repair_proposals_car_id              ON public.repair_proposals(car_id);
CREATE INDEX IF NOT EXISTS idx_repair_proposals_customer_id         ON public.repair_proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivered_by            ON public.sales_orders(delivered_by);
CREATE INDEX IF NOT EXISTS idx_system_preferences_updated_by_v2     ON public.system_preferences(updated_by);
CREATE INDEX IF NOT EXISTS idx_test_drives_customer_id              ON public.test_drives(customer_id);
