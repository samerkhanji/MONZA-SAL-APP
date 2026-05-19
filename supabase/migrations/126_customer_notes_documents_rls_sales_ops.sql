-- 126_customer_notes_documents_rls_sales_ops.sql
--
-- Broaden write access to customer_notes and customer_documents to include
-- sales_ops and assistant app roles (in addition to owners and users with
-- the 'sales' role/capability).
--
-- Background: today the policy uses `has_role('sales')` which excludes
-- sales_ops users (their primary role is 'sales_ops', not 'sales'). The
-- sales ops desk legitimately needs to file notes and upload documents on
-- behalf of the sales team, and so does the assistant. We keep the
-- `created_by / uploaded_by = auth.uid()` clause so users can only write
-- their own rows.
--
-- customer_documents previously had no UPDATE policy at all; we add one
-- mirroring customer_notes_update (owner or row author can update).

BEGIN;

-- customer_notes_insert: was (is_owner() OR has_role('sales')) AND created_by = auth.uid()
DROP POLICY IF EXISTS customer_notes_insert ON public.customer_notes;
CREATE POLICY customer_notes_insert
  ON public.customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      is_owner()
      OR has_role('sales'::public.user_role)
      OR has_role('sales_ops'::public.user_role)
      OR has_role('assistant'::public.user_role)
      OR has_capability('sales'::public.user_capability)
    )
    AND created_by = (SELECT auth.uid())
  );

-- customer_notes_update: was (is_owner() OR created_by = auth.uid())
-- Keep the "row author can edit their own notes" path, and add the
-- expanded role gate as an alternative.
DROP POLICY IF EXISTS customer_notes_update ON public.customer_notes;
CREATE POLICY customer_notes_update
  ON public.customer_notes
  FOR UPDATE
  TO authenticated
  USING (
    is_owner()
    OR created_by = (SELECT auth.uid())
    OR (
      (
        has_role('sales'::public.user_role)
        OR has_role('sales_ops'::public.user_role)
        OR has_role('assistant'::public.user_role)
        OR has_capability('sales'::public.user_capability)
      )
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_owner()
    OR created_by = (SELECT auth.uid())
    OR (
      (
        has_role('sales'::public.user_role)
        OR has_role('sales_ops'::public.user_role)
        OR has_role('assistant'::public.user_role)
        OR has_capability('sales'::public.user_capability)
      )
      AND created_by = (SELECT auth.uid())
    )
  );

-- customer_documents_insert: was (is_owner() OR has_role('sales')) AND uploaded_by = auth.uid()
-- NB: customer_documents tracks uploaded_by (not created_by); we keep that
-- naming to match the table.
DROP POLICY IF EXISTS customer_documents_insert ON public.customer_documents;
CREATE POLICY customer_documents_insert
  ON public.customer_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      is_owner()
      OR has_role('sales'::public.user_role)
      OR has_role('sales_ops'::public.user_role)
      OR has_role('assistant'::public.user_role)
      OR has_capability('sales'::public.user_capability)
    )
    AND uploaded_by = (SELECT auth.uid())
  );

-- customer_documents_update did not exist before. Add one mirroring notes:
-- owner can always update; row uploader can update their own row.
DROP POLICY IF EXISTS customer_documents_update ON public.customer_documents;
CREATE POLICY customer_documents_update
  ON public.customer_documents
  FOR UPDATE
  TO authenticated
  USING (
    is_owner()
    OR uploaded_by = (SELECT auth.uid())
    OR (
      (
        has_role('sales'::public.user_role)
        OR has_role('sales_ops'::public.user_role)
        OR has_role('assistant'::public.user_role)
        OR has_capability('sales'::public.user_capability)
      )
      AND uploaded_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_owner()
    OR uploaded_by = (SELECT auth.uid())
    OR (
      (
        has_role('sales'::public.user_role)
        OR has_role('sales_ops'::public.user_role)
        OR has_role('assistant'::public.user_role)
        OR has_capability('sales'::public.user_capability)
      )
      AND uploaded_by = (SELECT auth.uid())
    )
  );

COMMIT;
