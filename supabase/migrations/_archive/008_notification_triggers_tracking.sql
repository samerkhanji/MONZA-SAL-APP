-- ============================================
-- MONZA CRM - Notification Triggers Tracking
-- Migration 008: overtime_notified, warranty_notifications_sent
-- ============================================

ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS overtime_notified BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.warranty_notifications_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  warranty_type TEXT NOT NULL CHECK (warranty_type IN ('dms', 'monza')),
  threshold_days INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(car_id, warranty_type, threshold_days)
);

CREATE TABLE IF NOT EXISTS public.service_day_notifications_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  sent_date DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, sent_date)
);

ALTER TABLE public.warranty_notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_day_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage warranty notifications" ON public.warranty_notifications_sent
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage service day notifications" ON public.service_day_notifications_sent
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
