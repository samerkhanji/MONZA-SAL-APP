-- 114_garage_staff_rls_for_jobs_and_cars.sql
--
-- Grant garage_staff the access they need to do their day job:
--   * READ garage_jobs unrestricted (UI shows "only my assignments" but the
--     pool of jobs they might pick up has to be visible).
--   * UPDATE garage_jobs only for rows assigned to themselves (their own row).
--     INSERT remains manager+ (garage_staff cannot create jobs).
--   * READ cars (read-only). cars_update_restricted is intentionally NOT
--     extended to garage_staff -- they must not edit car records.
--
-- Existing roles in the pool: owner, garage_manager, sales_ops, assistant,
-- hybrid. We add garage_staff to the relevant SELECT/UPDATE policies.

-- garage_jobs SELECT: add garage_staff (unrestricted; UI filters by assignee)
DROP POLICY IF EXISTS garage_jobs_select_access ON public.garage_jobs;
CREATE POLICY garage_jobs_select_access
  ON public.garage_jobs
  FOR SELECT
  USING (
    public.is_any_role_resolved(ARRAY[
      'owner'::user_role,
      'garage_manager'::user_role,
      'sales_ops'::user_role,
      'assistant'::user_role,
      'hybrid'::user_role,
      'garage_staff'::user_role
    ])
  );

-- garage_jobs INSERT: explicitly NOT including garage_staff. Creation is
-- restricted to manager+/dispatcher roles.
DROP POLICY IF EXISTS garage_jobs_insert_access ON public.garage_jobs;
CREATE POLICY garage_jobs_insert_access
  ON public.garage_jobs
  FOR INSERT
  WITH CHECK (
    public.is_any_role_resolved(ARRAY[
      'owner'::user_role,
      'garage_manager'::user_role,
      'sales_ops'::user_role,
      'assistant'::user_role,
      'hybrid'::user_role
    ])
  );

-- garage_jobs UPDATE: managers etc keep full update access. garage_staff
-- can update ONLY rows assigned to them, and may not re-assign away
-- (WITH CHECK also enforces assigned_to = auth.uid()).
DROP POLICY IF EXISTS garage_jobs_update_access ON public.garage_jobs;
CREATE POLICY garage_jobs_update_access
  ON public.garage_jobs
  FOR UPDATE
  USING (
    public.is_any_role_resolved(ARRAY[
      'owner'::user_role,
      'garage_manager'::user_role,
      'sales_ops'::user_role,
      'assistant'::user_role,
      'hybrid'::user_role
    ])
    OR (
      public.is_any_role_resolved(ARRAY['garage_staff'::user_role])
      AND assigned_to = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(ARRAY[
      'owner'::user_role,
      'garage_manager'::user_role,
      'sales_ops'::user_role,
      'assistant'::user_role,
      'hybrid'::user_role
    ])
    OR (
      public.is_any_role_resolved(ARRAY['garage_staff'::user_role])
      AND assigned_to = (SELECT auth.uid())
    )
  );

-- cars SELECT: add garage_staff (read-only)
DROP POLICY IF EXISTS cars_select_access ON public.cars;
CREATE POLICY cars_select_access
  ON public.cars
  FOR SELECT
  USING (
    public.is_any_role_resolved(ARRAY[
      'owner'::user_role,
      'garage_manager'::user_role,
      'sales_ops'::user_role,
      'assistant'::user_role,
      'hybrid'::user_role,
      'garage_staff'::user_role
    ])
  );

-- NOTE: cars_update_restricted is intentionally untouched. garage_staff
-- must not edit car records.
