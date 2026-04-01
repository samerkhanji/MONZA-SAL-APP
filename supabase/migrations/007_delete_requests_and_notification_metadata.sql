-- ============================================
-- MONZA CRM - Delete Approval Workflow
-- Migration 007: delete_requests table + notification metadata
-- ============================================

CREATE TABLE IF NOT EXISTS public.delete_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('car', 'part')),
  item_id UUID NOT NULL,
  item_details JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own delete requests" ON public.delete_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Users can submit delete requests" ON public.delete_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Owners can review delete requests" ON public.delete_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Add metadata to notifications for delete request actions
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_delete_requests_status ON public.delete_requests(status);
CREATE INDEX IF NOT EXISTS idx_delete_requests_item ON public.delete_requests(item_type, item_id);
