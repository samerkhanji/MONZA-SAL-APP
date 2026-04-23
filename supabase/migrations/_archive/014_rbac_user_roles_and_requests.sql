-- ============================================
-- MONZA CRM - RBAC User Roles & Requests
-- Migration 014: user_role enum, request fields, RLS by role
-- ============================================

-- 1) USER ROLES - enum and profiles.user_role

-- Create role enum if not exists
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'owner',
    'assistant', 
    'khalil_hybrid',
    'it',
    'garage_manager',
    'garage_staff',
    'sales_ops'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add user_role column to profiles if not exists
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_role user_role;

-- Seed user_role based on full_name patterns (one-time bootstrap)
UPDATE public.profiles
SET user_role = 'owner'
WHERE user_role IS NULL
  AND (
    full_name ILIKE '%Houssam%' OR
    full_name ILIKE '%Kareem%'
  );

UPDATE public.profiles
SET user_role = 'assistant'
WHERE user_role IS NULL
  AND (
    full_name ILIKE '%Lara%' OR
    full_name ILIKE '%Samaya%'
  );

UPDATE public.profiles
SET user_role = 'khalil_hybrid'
WHERE user_role IS NULL
  AND full_name ILIKE '%Khalil%';

UPDATE public.profiles
SET user_role = 'it'
WHERE user_role IS NULL
  AND full_name ILIKE '%Elie%';

UPDATE public.profiles
SET user_role = 'garage_manager'
WHERE user_role IS NULL
  AND full_name ILIKE '%Mark%';

UPDATE public.profiles
SET user_role = 'garage_staff'
WHERE user_role IS NULL
  AND full_name ILIKE '%Suhail%';

UPDATE public.profiles
SET user_role = 'sales_ops'
WHERE user_role IS NULL
  AND full_name ILIKE '%Nivine%';


-- 2) REQUEST CENTER - new addressing / review fields

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES public.profiles(id);

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS recipient_role user_role;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

-- Preserve existing reviewed_by column from earlier migrations (already present).

CREATE INDEX IF NOT EXISTS idx_requests_recipient_user_id
  ON public.requests(recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_requests_recipient_role
  ON public.requests(recipient_role);


-- 3) RLS: Requests visibility by role

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_select" ON public.requests;
DROP POLICY IF EXISTS "Request visibility by role" ON public.requests;

CREATE POLICY "Request visibility by role" ON public.requests
  FOR SELECT TO authenticated
  USING (
    -- Owners see all
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_role = 'owner'
    )
    OR
    -- Assistants see owner-directed requests + their own
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND user_role = 'assistant'
      )
      AND (
        recipient_role = 'owner'
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = recipient_user_id AND user_role = 'owner'
        )
        OR submitted_by = auth.uid()
        OR recipient_user_id = auth.uid()
      )
    )
    OR
    -- IT sees own + IT category
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND user_role = 'it'
      )
      AND (
        submitted_by = auth.uid()
        OR recipient_user_id = auth.uid()
        OR category = 'IT'
      )
    )
    OR
    -- Garage manager sees own + Garage/Maintenance category
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND user_role = 'garage_manager'
      )
      AND (
        submitted_by = auth.uid()
        OR recipient_user_id = auth.uid()
        OR category IN ('Garage', 'Maintenance')
      )
    )
    OR
    -- Everyone else: only own sent/received
    submitted_by = auth.uid()
    OR recipient_user_id = auth.uid()
  );


-- 4) RLS: Requests update by role (assistant/owner based, replacing name-based checks)

DROP POLICY IF EXISTS "requests_update" ON public.requests;

CREATE POLICY "requests_update_by_role" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    -- Creator or assignee can update their own requests
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    -- Owners can update any request
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_role = 'owner'
    )
    -- Assistants can update requests directed to owners
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND user_role = 'assistant'
      )
      AND (
        recipient_role = 'owner'
        OR EXISTS (
          SELECT 1 FROM public.profiles o
          WHERE o.id = recipient_user_id AND o.user_role = 'owner'
        )
      )
    )
  );


-- 5) RLS: Garage jobs visibility by role

ALTER TABLE public.garage_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view garage jobs" ON public.garage_jobs;
DROP POLICY IF EXISTS "Garage job visibility by role" ON public.garage_jobs;

CREATE POLICY "Garage job visibility by role" ON public.garage_jobs
  FOR SELECT TO authenticated
  USING (
    -- Owner, assistant, and garage manager see all jobs
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND user_role IN ('owner', 'assistant', 'garage_manager')
    )
    -- Garage staff see only jobs assigned to them
    OR assigned_to = auth.uid()
  );

