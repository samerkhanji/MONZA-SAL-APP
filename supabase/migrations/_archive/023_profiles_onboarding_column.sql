-- Ensure onboarding_completed_at exists (in case migration 015 was not applied)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
