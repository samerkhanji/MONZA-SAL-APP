-- Phase 1: profile activity, preferred language, installment interest, part receipt logging

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

ALTER TABLE public.payment_plans
  ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_active_at IS 'Updated by app heartbeat (throttled); used for team presence.';
COMMENT ON COLUMN public.profiles.preferred_language IS 'User UI language preference, e.g. en, ar.';
COMMENT ON COLUMN public.payment_plans.interest_rate IS 'Annual or policy-defined late interest rate; application-specific.';
COMMENT ON COLUMN public.parts.received_at IS 'When the part was logged as physically received.';
