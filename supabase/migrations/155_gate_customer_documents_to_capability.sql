-- ============================================
-- Monza S.A.L. — tightest-access model for customer documents
-- Migration 155
--
-- Customer documents (and their metadata) carry passport scans, IDs,
-- insurance certificates and similar PII. Visibility is now gated by the
-- explicit `view_customer_documents` capability added in Migration 154.
-- Owners (who auto-have all caps via trg_profiles_owner_gets_all_capabilities)
-- and any user explicitly granted this capability can read/upload.
-- Everyone else is fully denied, even if they hold customer-edit rights.
--
-- This migration:
--   1. Backfills the new capability for every active owner profile
--      (the existing trigger only fires on profile row writes, so live
--      rows need a one-time UPDATE).
--   2. Replaces SELECT/INSERT/UPDATE policies on public.customer_documents.
--   3. Replaces SELECT/INSERT storage policies on the customer-documents
--      bucket. DELETE remains is_owner() — owner-only destructive action.
-- ============================================

-- (1) Backfill
UPDATE public.profiles
SET capabilities = array_append(capabilities, 'view_customer_documents'::user_capability),
    updated_at   = now()
WHERE user_role = 'owner'
  AND is_active = true
  AND NOT ('view_customer_documents'::user_capability = ANY(capabilities));

-- (2) Table policies on public.customer_documents
DROP POLICY IF EXISTS customer_documents_select_all ON public.customer_documents;
DROP POLICY IF EXISTS customer_documents_select     ON public.customer_documents;
CREATE POLICY customer_documents_select
  ON public.customer_documents FOR SELECT TO authenticated
  USING (is_owner() OR has_capability('view_customer_documents'::user_capability));

DROP POLICY IF EXISTS customer_documents_insert ON public.customer_documents;
CREATE POLICY customer_documents_insert
  ON public.customer_documents FOR INSERT TO authenticated
  WITH CHECK (
    (is_owner() OR has_capability('view_customer_documents'::user_capability))
    AND uploaded_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS customer_documents_update ON public.customer_documents;
CREATE POLICY customer_documents_update
  ON public.customer_documents FOR UPDATE TO authenticated
  USING (
    is_owner()
    OR (has_capability('view_customer_documents'::user_capability) AND uploaded_by = (SELECT auth.uid()))
  )
  WITH CHECK (
    is_owner()
    OR (has_capability('view_customer_documents'::user_capability) AND uploaded_by = (SELECT auth.uid()))
  );

-- (3) Storage bucket policies on customer-documents
DROP POLICY IF EXISTS customer_docs_select_scoped ON storage.objects;
CREATE POLICY customer_docs_select_scoped
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-documents'
    AND (is_owner() OR has_capability('view_customer_documents'::user_capability))
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS customer_docs_insert_scoped ON storage.objects;
CREATE POLICY customer_docs_insert_scoped
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'customer-documents'
    AND (is_owner() OR has_capability('view_customer_documents'::user_capability))
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );
