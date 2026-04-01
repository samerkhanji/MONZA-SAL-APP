-- ============================================
-- MONZA CRM - Request Center
-- Migration 002: Internal request workflow
-- ============================================

CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'awaiting_approval',
    'approved',
    'rejected',
    'needs_more_info'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  assistant_notes TEXT,
  management_comments TEXT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  forwarded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.request_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_submitted_by ON public.requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON public.requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can read all requests, insert their own, update based on role
CREATE POLICY "requests_select" ON public.requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "requests_insert" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "requests_update" ON public.requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "request_attachments_select" ON public.request_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "request_attachments_insert" ON public.request_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "request_notifications_select" ON public.request_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "request_notifications_insert" ON public.request_notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for request attachments (create via Supabase Dashboard: Storage > New bucket > request-attachments, private)
