-- ============================================
-- Enable RLS on public.parts
-- (Policies restricted in 015_parts_rls_restrict_policies.sql)
-- ============================================

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view parts" ON public.parts;
CREATE POLICY "Authenticated users can view parts"
  ON public.parts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert parts" ON public.parts;
CREATE POLICY "Authenticated users can insert parts"
  ON public.parts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update parts" ON public.parts;
CREATE POLICY "Authenticated users can update parts"
  ON public.parts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete parts" ON public.parts;
CREATE POLICY "Authenticated users can delete parts"
  ON public.parts FOR DELETE
  TO authenticated
  USING (true);
