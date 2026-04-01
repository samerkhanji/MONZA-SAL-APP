-- ============================================
-- MONZA CRM - Notifications & Permissions
-- Migration 006: Full notification system and access control
-- ============================================

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- In-app notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Document access requests
CREATE TABLE IF NOT EXISTS public.document_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID REFERENCES public.profiles(id),
  search_query TEXT NOT NULL,
  document_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.document_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own document requests" ON public.document_access_requests;
CREATE POLICY "Users see own document requests" ON public.document_access_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
  ));

DROP POLICY IF EXISTS "Users insert own document requests" ON public.document_access_requests;
CREATE POLICY "Users insert own document requests" ON public.document_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Owners update document requests" ON public.document_access_requests;
CREATE POLICY "Owners update document requests" ON public.document_access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- Page access requests (for garage history, etc.)
CREATE TABLE IF NOT EXISTS public.page_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID REFERENCES public.profiles(id),
  page_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.page_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own page requests" ON public.page_access_requests;
CREATE POLICY "Users see own page requests" ON public.page_access_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
  ));

DROP POLICY IF EXISTS "Users insert own page requests" ON public.page_access_requests;
CREATE POLICY "Users insert own page requests" ON public.page_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Owners update page requests" ON public.page_access_requests;
CREATE POLICY "Owners update page requests" ON public.page_access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- Add delivered_at to garage_jobs
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Allow 'delivered' status in garage_jobs (run only if constraint exists)
DO $$
BEGIN
  ALTER TABLE public.garage_jobs DROP CONSTRAINT IF EXISTS garage_jobs_status_check;
  ALTER TABLE public.garage_jobs ADD CONSTRAINT garage_jobs_status_check
    CHECK (status IN ('pending', 'in_progress', 'waiting_parts', 'done', 'delivered', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add send_to_user_id for employee-to-employee requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS send_to_user_id UUID REFERENCES public.profiles(id);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
