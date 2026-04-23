-- ============================================
-- MONZA CRM - Request Center Send To
-- Migration 004: Add send_to and reviewed_by columns
-- ============================================

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS send_to TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_requests_send_to ON public.requests(send_to);
