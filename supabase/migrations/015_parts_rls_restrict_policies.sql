-- ============================================
-- Restrict parts RLS policies (fix "always true" security issue)
-- INSERT/UPDATE: owner, sales, garage_manager only
-- DELETE: owner only
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can insert parts" ON public.parts;
DROP POLICY IF EXISTS "Role-restricted insert parts" ON public.parts;
CREATE POLICY "Role-restricted insert parts"
  ON public.parts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'sales', 'garage_manager')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update parts" ON public.parts;
DROP POLICY IF EXISTS "Role-restricted update parts" ON public.parts;
CREATE POLICY "Role-restricted update parts"
  ON public.parts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'sales', 'garage_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'sales', 'garage_manager')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete parts" ON public.parts;
DROP POLICY IF EXISTS "Role-restricted delete parts" ON public.parts;
CREATE POLICY "Role-restricted delete parts"
  ON public.parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );
