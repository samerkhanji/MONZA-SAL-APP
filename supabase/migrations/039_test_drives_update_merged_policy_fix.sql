-- Fix test_drives UPDATE policy (scalar subqueries; single merged policy).
-- Safe if 034 already ran with older policy names or a broken merged fragment.

DROP POLICY IF EXISTS "test_drives_update_access" ON public.test_drives;
DROP POLICY IF EXISTS "test_drives_update_sales_roles" ON public.test_drives;
DROP POLICY IF EXISTS "test_drives_update_merged" ON public.test_drives;

CREATE POLICY "test_drives_update_merged"
  ON public.test_drives
  FOR UPDATE
  TO authenticated
  USING (
    (
      (SELECT public.is_any_role_resolved(ARRAY[
        'owner'::public.user_role,
        'assistant'::public.user_role,
        'sales_ops'::public.user_role,
        'garage_manager'::public.user_role,
        'garage_staff'::public.user_role,
        'khalil_hybrid'::public.user_role,
        'it'::public.user_role
      ]))
    )
  )
  WITH CHECK (
    (
      (SELECT public.is_any_role_resolved(ARRAY[
        'owner'::public.user_role,
        'assistant'::public.user_role,
        'sales_ops'::public.user_role,
        'garage_manager'::public.user_role,
        'garage_staff'::public.user_role,
        'khalil_hybrid'::public.user_role,
        'it'::public.user_role
      ]))
    )
  );
