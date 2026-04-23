-- Allow Lara and Samaya (request assistants) to update requests sent to houssam/kareem
DROP POLICY IF EXISTS "requests_update" ON "public"."requests";

CREATE POLICY "requests_update" ON "public"."requests"
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
    OR (
      requests.send_to IN ('houssam', 'kareem')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (LOWER(COALESCE(p.full_name, '')) LIKE '%lara%' OR LOWER(COALESCE(p.full_name, '')) LIKE '%samaya%')
      )
    )
  );
