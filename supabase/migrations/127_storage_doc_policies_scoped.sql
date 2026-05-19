-- 127_storage_doc_policies_scoped.sql
--
-- !! APPLY THIS VIA THE SUPABASE DASHBOARD SQL EDITOR.
-- The Supabase MCP migration runner authenticates as `postgres`, which is
-- NOT a member of `supabase_storage_admin` (the owner of storage.objects).
-- Running this via `apply_migration` or `execute_sql` fails with
-- "must be owner of relation objects (42501)". The dashboard editor
-- escalates to the storage admin role automatically.
--
-- Tighten storage.objects RLS for the `customer-documents` and
-- `job-documents` buckets. The previous policies only checked
-- `bucket_id = '...'` which let any authenticated user upload to, or read,
-- ANY file in those buckets — including files attached to customers/jobs
-- they have no business touching.
--
-- Scoping decisions:
--
--   customer-documents:
--     The web UI uploads to `${customer_id}/${doc_type}/${ts}_${name}` and
--     reads via signed URL. We can therefore enforce that the FIRST folder
--     segment is a real customer.id and that the caller has a sales-side
--     role/capability OR is owner OR is sales_ops/assistant. This matches
--     migration 126's data-row policy.
--
--   job-documents:
--     Two known upload path shapes exist in the current code:
--       1) `${job_id}/${doc_type}/${ts}_${name}` (garage JobDocuments)
--       2) `warranty/${warranty_claim_id}/${ts}-${name}`
--          (garage warranty page)
--     A strict `foldername(name)[1] = job_id::text` check would break (2)
--     because the first segment is the literal `warranty`. Auditing every
--     job-documents call site and refactoring path shapes is out of scope
--     for this hotfix.
--
--     **Decision**: drop the wide-open INSERT/SELECT, replace with
--     authenticated-only + garage/owner gating. Strict per-job folder
--     scoping is a **P0 follow-up** tracked separately. Comment is
--     attached to the new policies so future readers see this.
--
-- All operations are written defensively (DROP IF EXISTS + CREATE) so
-- this migration is idempotent.

BEGIN;

-- ============================================================
-- customer-documents bucket
-- ============================================================

-- Drop the old over-permissive policies.
DROP POLICY IF EXISTS "Auth users can upload customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view customer documents"   ON storage.objects;

-- Scoped INSERT: caller must (a) be allowed to write customer rows in
-- general (mirrors migration 126's customer_documents_insert policy) AND
-- (b) the first folder segment must match an existing customers.id.
CREATE POLICY "customer_docs_insert_scoped"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-documents'
    AND (
      public.is_owner()
      OR public.has_role('sales'::public.user_role)
      OR public.has_role('sales_ops'::public.user_role)
      OR public.has_role('assistant'::public.user_role)
      OR public.has_capability('sales'::public.user_capability)
    )
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

-- Scoped SELECT: same gate; readable to users who can write customer rows
-- and where the first folder segment is a valid customer.
CREATE POLICY "customer_docs_select_scoped"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customer-documents'
    AND (
      public.is_owner()
      OR public.has_role('sales'::public.user_role)
      OR public.has_role('sales_ops'::public.user_role)
      OR public.has_role('assistant'::public.user_role)
      OR public.has_capability('sales'::public.user_capability)
    )
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "customer_docs_insert_scoped" ON storage.objects IS
  'Scoped via first-folder=customer_id. Migrated from over-permissive '
  '"Auth users can upload customer documents" in migration 127.';
COMMENT ON POLICY "customer_docs_select_scoped" ON storage.objects IS
  'Scoped via first-folder=customer_id. Migrated from over-permissive '
  '"Auth users can view customer documents" in migration 127.';

-- ============================================================
-- job-documents bucket
-- ============================================================
--
-- Path shapes in use today (web/src/**):
--   garage/JobDocuments.tsx          → `${jobId}/${doc_type}/...`
--   garage/warranty/[id]/page.tsx    → `warranty/${warrantyClaimId}/...`
--
-- A strict `foldername[1] = job_id::text` policy would block the second
-- path. P0 follow-up: refactor warranty uploads to use either a sibling
-- `warranty-documents` bucket OR a `job/{jobId}/...` prefix so the
-- folder-scoping policy can land safely.
--
-- For now, we drop the "any authenticated user" policy and replace with
-- garage/owner/manage_team role gating.

DROP POLICY IF EXISTS "Auth users can upload job documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view job documents"   ON storage.objects;

CREATE POLICY "job_docs_insert_role_gated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-documents'
    AND (
      public.is_owner()
      OR public.has_capability('garage'::public.user_capability)
      OR public.has_capability('manage_team'::public.user_capability)
    )
  );

CREATE POLICY "job_docs_select_role_gated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-documents'
    AND (
      public.is_owner()
      OR public.has_capability('garage'::public.user_capability)
      OR public.has_capability('manage_team'::public.user_capability)
      OR public.has_capability('view_reports'::public.user_capability)
    )
  );

COMMENT ON POLICY "job_docs_insert_role_gated" ON storage.objects IS
  'P0 FOLLOW-UP: tighten to per-job folder scoping once warranty upload '
  'path shape is unified. See migration 127 header.';
COMMENT ON POLICY "job_docs_select_role_gated" ON storage.objects IS
  'P0 FOLLOW-UP: tighten to per-job folder scoping once warranty upload '
  'path shape is unified. See migration 127 header.';

COMMIT;
