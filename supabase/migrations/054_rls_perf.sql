-- Migration 054: RLS performance pass.
--
-- Two classes of fix:
-- 1. auth_rls_initplan: wrap `auth.uid()` in `(SELECT auth.uid())` so the
--    planner evaluates it ONCE per query instead of once per row.
-- 2. multiple_permissive_policies: split `FOR ALL` write policies into
--    INSERT/UPDATE/DELETE so SELECT no longer evaluates two policies.
--    For garage_tasks, merge the two role-dispatch policies into one OR'd
--    policy each.
--
-- Pure semantic-preserving rewrites — no policy logic changes.

------------------------------------------------------------
-- 1. Initplan: rewrap auth.uid() inside (SELECT …)
------------------------------------------------------------

-- profiles.profiles_update_self_or_owner
DROP POLICY IF EXISTS profiles_update_self_or_owner ON public.profiles;
CREATE POLICY profiles_update_self_or_owner ON public.profiles
  FOR UPDATE
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active = true
        AND p.user_role = 'owner'::user_role
    )
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active = true
        AND p.user_role = 'owner'::user_role
    )
  );

-- requests.requests_insert_own
DROP POLICY IF EXISTS requests_insert_own ON public.requests;
CREATE POLICY requests_insert_own ON public.requests
  FOR INSERT
  WITH CHECK (submitted_by = (SELECT auth.uid()));

-- requests.requests_update_owner_or_party
DROP POLICY IF EXISTS requests_update_owner_or_party ON public.requests;
CREATE POLICY requests_update_owner_or_party ON public.requests
  FOR UPDATE
  USING (
    submitted_by = (SELECT auth.uid())
    OR assigned_to = (SELECT auth.uid())
    OR reviewed_by = (SELECT auth.uid())
    OR is_any_role_resolved(ARRAY['owner'::user_role])
  )
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    OR assigned_to = (SELECT auth.uid())
    OR reviewed_by = (SELECT auth.uid())
    OR is_any_role_resolved(ARRAY['owner'::user_role])
  );

-- garage_task_templates.garage_task_templates_select_auth
DROP POLICY IF EXISTS garage_task_templates_select_auth ON public.garage_task_templates;
CREATE POLICY garage_task_templates_select_auth ON public.garage_task_templates
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

-- garage_task_template_items.garage_task_template_items_select_auth
DROP POLICY IF EXISTS garage_task_template_items_select_auth ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_select_auth ON public.garage_task_template_items
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

-- garage_capacities.garage_capacities_select_auth
DROP POLICY IF EXISTS garage_capacities_select_auth ON public.garage_capacities;
CREATE POLICY garage_capacities_select_auth ON public.garage_capacities
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

-- infrastructure_compute_target.{select,update}_owner
DROP POLICY IF EXISTS infrastructure_compute_target_select_owner ON public.infrastructure_compute_target;
CREATE POLICY infrastructure_compute_target_select_owner ON public.infrastructure_compute_target
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.user_role = 'owner'::user_role
    )
  );

DROP POLICY IF EXISTS infrastructure_compute_target_update_owner ON public.infrastructure_compute_target;
CREATE POLICY infrastructure_compute_target_update_owner ON public.infrastructure_compute_target
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.user_role = 'owner'::user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.user_role = 'owner'::user_role
    )
  );

-- task_timers (3 policies)
DROP POLICY IF EXISTS task_timers_insert_own ON public.task_timers;
CREATE POLICY task_timers_insert_own ON public.task_timers
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS task_timers_select_own_or_mgmt ON public.task_timers;
CREATE POLICY task_timers_select_own_or_mgmt ON public.task_timers
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role, 'assistant'::user_role])
  );

DROP POLICY IF EXISTS task_timers_update_own ON public.task_timers;
CREATE POLICY task_timers_update_own ON public.task_timers
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- page_access_requests
DROP POLICY IF EXISTS page_access_insert_own ON public.page_access_requests;
CREATE POLICY page_access_insert_own ON public.page_access_requests
  FOR INSERT
  WITH CHECK (requested_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS page_access_select_own_or_owner ON public.page_access_requests;
CREATE POLICY page_access_select_own_or_owner ON public.page_access_requests
  FOR SELECT
  USING (
    requested_by = (SELECT auth.uid())
    OR is_any_role_resolved(ARRAY['owner'::user_role])
  );

------------------------------------------------------------
-- 2. multiple_permissive_policies: split `FOR ALL` writes
------------------------------------------------------------
-- Pattern: a `_select` policy (USING true) + a `_write` policy with
-- `FOR ALL`. The `_write` policy's USING is also evaluated on SELECT,
-- producing two policies for the same (role, SELECT). Replace `_write`
-- with three separate INSERT/UPDATE/DELETE policies.

-- accessory_custom_items
DROP POLICY IF EXISTS acc_custom_items_write ON public.accessory_custom_items;
CREATE POLICY acc_custom_items_insert ON public.accessory_custom_items
  FOR INSERT
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));
CREATE POLICY acc_custom_items_update ON public.accessory_custom_items
  FOR UPDATE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));
CREATE POLICY acc_custom_items_delete ON public.accessory_custom_items
  FOR DELETE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));

-- accessory_custom_tables
DROP POLICY IF EXISTS acc_custom_tables_write ON public.accessory_custom_tables;
CREATE POLICY acc_custom_tables_insert ON public.accessory_custom_tables
  FOR INSERT
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));
CREATE POLICY acc_custom_tables_update ON public.accessory_custom_tables
  FOR UPDATE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));
CREATE POLICY acc_custom_tables_delete ON public.accessory_custom_tables
  FOR DELETE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role, 'garage_manager'::user_role]));

-- car_warranties
DROP POLICY IF EXISTS car_warranties_write ON public.car_warranties;
CREATE POLICY car_warranties_insert ON public.car_warranties
  FOR INSERT
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'hybrid'::user_role]));
CREATE POLICY car_warranties_update ON public.car_warranties
  FOR UPDATE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'hybrid'::user_role]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'hybrid'::user_role]));
CREATE POLICY car_warranties_delete ON public.car_warranties
  FOR DELETE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'hybrid'::user_role]));

-- garage_job_bay_context
DROP POLICY IF EXISTS gjbc_write_garage ON public.garage_job_bay_context;
CREATE POLICY gjbc_insert_garage ON public.garage_job_bay_context
  FOR INSERT
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role, 'garage_staff'::user_role, 'assistant'::user_role]));
CREATE POLICY gjbc_update_garage ON public.garage_job_bay_context
  FOR UPDATE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role, 'garage_staff'::user_role, 'assistant'::user_role]))
  WITH CHECK (is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role, 'garage_staff'::user_role, 'assistant'::user_role]));
CREATE POLICY gjbc_delete_garage ON public.garage_job_bay_context
  FOR DELETE
  USING (is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role, 'garage_staff'::user_role, 'assistant'::user_role]));

-- garage_tasks: merge the two role-dispatch policies into one OR'd policy each.
DROP POLICY IF EXISTS garage_tasks_select_assigned ON public.garage_tasks;
DROP POLICY IF EXISTS garage_tasks_select_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_select ON public.garage_tasks
  FOR SELECT
  USING (
    is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role])
    OR (
      get_my_user_role_resolved() = 'garage_staff'::user_role
      AND assigned_to = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS garage_tasks_update_assigned_staff ON public.garage_tasks;
DROP POLICY IF EXISTS garage_tasks_update_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_update ON public.garage_tasks
  FOR UPDATE
  USING (
    is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role])
    OR (
      get_my_user_role_resolved() = 'garage_staff'::user_role
      AND assigned_to = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_any_role_resolved(ARRAY['owner'::user_role, 'garage_manager'::user_role])
    OR (
      get_my_user_role_resolved() = 'garage_staff'::user_role
      AND assigned_to = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
