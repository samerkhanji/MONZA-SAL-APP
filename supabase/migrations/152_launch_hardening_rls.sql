-- ============================================
-- Monza App - Launch hardening: 5 pre-launch fixes
-- Migration 152
--
-- Bundles five launch-blocking findings from the pre-launch audit:
--
-- (A) customer-documents storage policies excluded hybrid / khalil_hybrid /
--     it roles even though CRUD_PERMISSIONS.customers grants them the
--     upload UI. Result: button visible, upload silently 403s for those
--     roles. Khalil currently has user_role = 'hybrid', so this blocks
--     a real employee. Extend insert + select policies to include them.
--
-- (B) public.customers.customers_select_all was qual=true — any
--     authenticated employee (incl. garage_staff/it) could read every
--     customer's PII and every soft-deleted/anonymized row. Replace with
--     role-gated policy + deleted_at filter, mirroring cars_select_access.
--
-- (C) storage.objects.car_docs_read_auth checked only the bucket id, so
--     any signed-in employee could fetch any car document via signed URL.
--     The other doc buckets (customer/job) already gate SELECT by role +
--     folder; bring car-documents in line by gating by role.
--
-- (D) trade-in document uploads at trade-ins/[id]/page.tsx push files to
--     the job-documents bucket under path `trade-ins/${id}/...`. The
--     job_docs_insert_role_gated policy only allowed garage roles, so
--     sales-team uploads silently 403'd. Extend insert + select to allow
--     sales/sales_ops/hybrid when the first folder segment is 'trade-ins'.
--
-- (E) broadcast_car_changes() is SECURITY DEFINER, executable by anon and
--     PUBLIC, with no search_path pinned. Only used as a trigger on cars
--     — no client should ever call it via REST. Pin search_path + revoke
--     EXECUTE from anon/PUBLIC/authenticated. The trigger fires regardless
--     because it's owned by postgres.
--
-- The Studio-generated policy names with random nonce suffixes are also
-- renamed to clean stable IDs while we're touching them.
-- ============================================

-- (A) customer-documents: extend role list to include hybrid/khalil_hybrid/it
DROP POLICY IF EXISTS "customer_docs_insert_scoped 1t7nrt5_0" ON storage.objects;
CREATE POLICY customer_docs_insert_scoped
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'customer-documents'
    AND (
      is_owner()
      OR has_role('sales'::user_role)
      OR has_role('sales_ops'::user_role)
      OR has_role('assistant'::user_role)
      OR has_role('hybrid'::user_role)
      OR has_role('khalil_hybrid'::user_role)
      OR has_role('it'::user_role)
      OR has_capability('sales'::user_capability)
    )
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "customer_docs_select_scoped 1t7nrt5_0" ON storage.objects;
CREATE POLICY customer_docs_select_scoped
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-documents'
    AND (
      is_owner()
      OR has_role('sales'::user_role)
      OR has_role('sales_ops'::user_role)
      OR has_role('assistant'::user_role)
      OR has_role('hybrid'::user_role)
      OR has_role('khalil_hybrid'::user_role)
      OR has_role('it'::user_role)
      OR has_capability('sales'::user_capability)
    )
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

-- (B) customers SELECT — role-gated + deleted_at filter
DROP POLICY IF EXISTS customers_select_all ON public.customers;
CREATE POLICY customers_select_all
  ON public.customers FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND is_any_role_resolved(ARRAY[
      'owner','assistant','sales_ops','sales','garage_manager','hybrid','it'
    ]::user_role[])
  );

-- (C) car-documents read — gate by role, mirroring customer/job patterns
DROP POLICY IF EXISTS car_docs_read_auth ON storage.objects;
CREATE POLICY car_docs_read_auth
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'car-documents'
    AND (
      is_owner()
      OR has_role('sales'::user_role)
      OR has_role('sales_ops'::user_role)
      OR has_role('assistant'::user_role)
      OR has_role('garage_manager'::user_role)
      OR has_role('hybrid'::user_role)
      OR has_role('khalil_hybrid'::user_role)
      OR has_capability('garage'::user_capability)
    )
  );

-- (D) job-documents: extend INSERT + SELECT to allow sales for trade-ins/* path
DROP POLICY IF EXISTS "job_docs_insert_role_gated i1186g_0" ON storage.objects;
CREATE POLICY job_docs_insert_role_gated
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-documents'
    AND (
      is_owner()
      OR has_capability('garage'::user_capability)
      OR has_capability('manage_team'::user_capability)
      OR (
        (storage.foldername(name))[1] = 'trade-ins'
        AND (
          has_role('sales'::user_role)
          OR has_role('sales_ops'::user_role)
          OR has_role('hybrid'::user_role)
          OR has_capability('sales'::user_capability)
        )
      )
    )
  );

DROP POLICY IF EXISTS "job_docs_select_role_gated i1186g_0" ON storage.objects;
CREATE POLICY job_docs_select_role_gated
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-documents'
    AND (
      is_owner()
      OR has_capability('garage'::user_capability)
      OR has_capability('manage_team'::user_capability)
      OR has_capability('view_reports'::user_capability)
      OR (
        (storage.foldername(name))[1] = 'trade-ins'
        AND (
          has_role('sales'::user_role)
          OR has_role('sales_ops'::user_role)
          OR has_role('hybrid'::user_role)
          OR has_capability('sales'::user_capability)
        )
      )
    )
  );

-- (E) broadcast_car_changes — pin search_path, revoke anon/PUBLIC EXECUTE
ALTER FUNCTION public.broadcast_car_changes() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.broadcast_car_changes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_car_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.broadcast_car_changes() FROM authenticated;
