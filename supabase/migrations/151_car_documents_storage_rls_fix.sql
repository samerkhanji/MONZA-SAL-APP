-- ============================================
-- Monza App - Fix car-documents storage RLS to match the actual upload path
-- Migration 151
--
-- car-documents.tsx (line ~293) and car-day-detail-dialog.tsx (line ~217)
-- upload files to `${carId}/${docType}/${timestamp}_${filename}`. The
-- existing storage policy `car_docs_upload_own_folder` required
-- `(storage.foldername(name))[1] = auth.uid()`, so every car-document
-- upload from the app failed the RLS check and the metadata insert was
-- never reached. End result: car uploads silently broken across the app.
--
-- Replace the policy with one that mirrors the table-level
-- public.car_documents INSERT policy (role-gated) and verifies the car
-- exists and is not soft-deleted — same shape as the working
-- customer-documents policy.
--
-- DELETE policy: the old `(first_folder = auth.uid() OR is_owner())`
-- check is replaced with `is_owner() OR uploader-of-this-file`, matching
-- the table-level UPDATE rule.
--
-- SELECT policy (`car_docs_read_auth`) is left as-is for now — it
-- mirrors the public.car_documents SELECT rule (any authenticated user).
-- ============================================

DROP POLICY IF EXISTS "car_docs_upload_own_folder" ON storage.objects;

CREATE POLICY "car_docs_insert_role_gated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'car-documents'
    AND (
      is_owner()
      OR has_role('sales'::user_role)
      OR has_role('garage_manager'::user_role)
      OR has_capability('garage'::user_capability)
    )
    AND EXISTS (
      SELECT 1 FROM public.cars c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "car_docs_delete_own_or_owner" ON storage.objects;

CREATE POLICY "car_docs_delete_role_gated"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'car-documents'
    AND (
      is_owner()
      OR EXISTS (
        SELECT 1 FROM public.car_documents cd
        WHERE cd.file_path = storage.objects.name
          AND cd.uploaded_by = ( SELECT auth.uid() )
      )
    )
  );
