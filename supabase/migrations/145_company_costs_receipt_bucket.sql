-- Migration 145: storage bucket for Company Costs receipts.
--
-- The Company Costs page lets staff attach a receipt / invoice image or PDF
-- to each cost entry. Receipts live in a dedicated private bucket. The path
-- shape is `{company_costs.id-or-staging-uuid}/{timestamp}_{filename}`.
--
-- Read / write is gated to the same capability holders allowed to read /
-- write the company_costs table (owner + cashier + manage_team + garage +
-- view_reports). The bucket is private; the page reads files via signed URLs.

-- ============================================================================
-- 1) Bucket
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cost-receipts', 'cost-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2) Policies on storage.objects for the cost-receipts bucket
-- ============================================================================
DROP POLICY IF EXISTS "cost_receipts_insert_role_gated" ON storage.objects;
CREATE POLICY "cost_receipts_insert_role_gated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cost-receipts'
    AND (
      public.is_owner()
      OR public.has_capability('cashier'::public.user_capability)
      OR public.has_capability('manage_team'::public.user_capability)
      OR public.has_capability('garage'::public.user_capability)
    )
  );

DROP POLICY IF EXISTS "cost_receipts_select_role_gated" ON storage.objects;
CREATE POLICY "cost_receipts_select_role_gated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cost-receipts'
    AND (
      public.is_owner()
      OR public.has_capability('cashier'::public.user_capability)
      OR public.has_capability('manage_team'::public.user_capability)
      OR public.has_capability('garage'::public.user_capability)
      OR public.has_capability('view_reports'::public.user_capability)
    )
  );

DROP POLICY IF EXISTS "cost_receipts_delete_owner" ON storage.objects;
CREATE POLICY "cost_receipts_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cost-receipts'
    AND public.is_owner()
  );
