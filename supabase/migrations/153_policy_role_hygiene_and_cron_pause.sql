-- ============================================
-- Monza App - Pre-launch policy + cron hygiene (per audit + Samer's
-- strategy answers Q1=B keep org-wide, Q2=B trust in-body, Q5=A fix cron)
-- Migration 153
--
-- (A) Widen customers_select_all to any authenticated employee (was
--     restricted to 7 of 9 user_roles after Mig 152). Per Q1=B the team
--     wants customer-record visibility kept org-wide, just gated to
--     authenticated and not surfacing soft-deleted rows.
--
-- (B) Tighten customer_documents_select_all + customer_notes_select_all
--     from qual=true to require an authenticated session. Functionally
--     equivalent to "org-wide" (Q1=B) but no longer trusts a
--     misconfigured RLS evaluator to gate anon.
--
-- (C) The 11 policies on public schema tables targeting role `public`
--     are auth-gated via their qual/with_check expressions, so they're
--     not currently exploitable — but listing `public` violates
--     least-privilege hygiene and breaks the Supabase pattern. Recreate
--     each with `TO authenticated`, preserving the existing qual /
--     with_check exactly. No behavior change for legitimate users.
--
-- (D) Pause the failing detect-overdue-test-drives cron. The function
--     body is sound; the failure is Supabase platform-side
--     ("job startup timeout") because the worker dispatcher can't start
--     the job in its allotted window. The test_drives table has 0 rows,
--     so nothing to detect anyway. Re-enable once the test-drive module
--     is wired up.
-- ============================================

-- (A)
DROP POLICY IF EXISTS customers_select_all ON public.customers;
CREATE POLICY customers_select_all
  ON public.customers FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (SELECT auth.uid()) IS NOT NULL);

-- (B)
DROP POLICY IF EXISTS customer_documents_select_all ON public.customer_documents;
CREATE POLICY customer_documents_select_all
  ON public.customer_documents FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS customer_notes_select_all ON public.customer_notes;
CREATE POLICY customer_notes_select_all
  ON public.customer_notes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- (C) Re-target 11 policies from `public` role to `authenticated`.
--     Quals are preserved verbatim from the existing definitions.

DROP POLICY IF EXISTS cars_select_access ON public.cars;
CREATE POLICY cars_select_access
  ON public.cars FOR SELECT TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','garage_manager','sales_ops','assistant','hybrid','garage_staff']::user_role[]));

DROP POLICY IF EXISTS garage_capacities_select_auth ON public.garage_capacities;
CREATE POLICY garage_capacities_select_auth
  ON public.garage_capacities FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS garage_jobs_select_access ON public.garage_jobs;
CREATE POLICY garage_jobs_select_access
  ON public.garage_jobs FOR SELECT TO authenticated
  USING (is_any_role_resolved(ARRAY['owner','garage_manager','sales_ops','assistant','hybrid','garage_staff']::user_role[]));

DROP POLICY IF EXISTS garage_jobs_insert_access ON public.garage_jobs;
CREATE POLICY garage_jobs_insert_access
  ON public.garage_jobs FOR INSERT TO authenticated
  WITH CHECK (is_any_role_resolved(ARRAY['owner','garage_manager','sales_ops','assistant','hybrid']::user_role[]));

DROP POLICY IF EXISTS garage_jobs_update_access ON public.garage_jobs;
CREATE POLICY garage_jobs_update_access
  ON public.garage_jobs FOR UPDATE TO authenticated
  USING (
    is_any_role_resolved(ARRAY['owner','garage_manager','sales_ops','assistant','hybrid']::user_role[])
    OR (is_any_role_resolved(ARRAY['garage_staff']::user_role[]) AND assigned_to = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS garage_task_template_items_select_auth ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_select_auth
  ON public.garage_task_template_items FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS garage_task_templates_select_auth ON public.garage_task_templates;
CREATE POLICY garage_task_templates_select_auth
  ON public.garage_task_templates FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS garage_tasks_select ON public.garage_tasks;
CREATE POLICY garage_tasks_select
  ON public.garage_tasks FOR SELECT TO authenticated
  USING (
    is_any_role_resolved(ARRAY['owner','garage_manager']::user_role[])
    OR (get_my_user_role_resolved() = 'garage_staff'::user_role AND assigned_to = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS infrastructure_compute_target_select_owner ON public.infrastructure_compute_target;
CREATE POLICY infrastructure_compute_target_select_owner
  ON public.infrastructure_compute_target FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.user_role = 'owner'::user_role
  ));

DROP POLICY IF EXISTS page_access_select_own_or_owner ON public.page_access_requests;
CREATE POLICY page_access_select_own_or_owner
  ON public.page_access_requests FOR SELECT TO authenticated
  USING (requested_by = (SELECT auth.uid()) OR is_any_role_resolved(ARRAY['owner']::user_role[]));

DROP POLICY IF EXISTS task_timers_select_own_or_mgmt ON public.task_timers;
CREATE POLICY task_timers_select_own_or_mgmt
  ON public.task_timers FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_any_role_resolved(ARRAY['owner','garage_manager','assistant']::user_role[])
  );

-- (D) Pause the failing cron until test_drives is wired up.
-- cron.job is owned by postgres; the per-cron API (cron.alter_job) is the
-- only way to flip `active` from a regular user role.
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'detect-overdue-test-drives'),
  active := false
);
