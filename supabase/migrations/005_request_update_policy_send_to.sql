-- ============================================
-- MONZA CRM - Request Center Update Policy
-- Migration 005: Allow assistants and send_to recipients to update
-- ============================================

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
      -- Assistants (Lara/Samaya): can update houssam requests in submitted status
      send_to = 'houssam' AND status = 'submitted'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.full_name ILIKE '%lara%' OR profiles.full_name ILIKE '%samaya%')
      )
    )
    OR (
      -- Samer: can update when send_to = samer and awaiting_approval
      send_to = 'samer' AND status = 'awaiting_approval'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.full_name ILIKE '%samer%'
      )
    )
    OR (
      -- Kareem: can update when send_to = kareem or (send_to = houssam and awaiting_approval)
      status = 'awaiting_approval'
      AND (send_to = 'kareem' OR send_to = 'houssam')
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.full_name ILIKE '%kareem%'
      )
    )
    OR (
      -- Houssam: can update when send_to = houssam and awaiting_approval
      send_to = 'houssam' AND status = 'awaiting_approval'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.full_name ILIKE '%houssam%'
      )
    )
  );
