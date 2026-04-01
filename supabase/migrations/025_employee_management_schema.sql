-- ============================================
-- MONZA CRM - Employee Management System
-- Migration 025: employment_status, capabilities_jsonb, audit fields
-- ============================================

-- 1) Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'inactive', 'suspended', 'terminated')),
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Add capabilities_jsonb for flexible permissions (coexists with legacy capabilities TEXT[])
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS capabilities_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Migrate existing role/capabilities to capabilities_jsonb (backfill)
UPDATE public.profiles
SET capabilities_jsonb = jsonb_build_object(
  'manage_team', (user_role = 'owner'),
  'edit_users', (user_role = 'owner'),
  'deactivate_users', (user_role = 'owner'),
  'view_inventory', true,
  'edit_inventory', user_role IN ('owner', 'sales_ops'),
  'view_sales', true,
  'edit_sales', user_role IN ('owner', 'sales_ops'),
  'view_garage', user_role IN ('owner', 'assistant', 'garage_manager', 'garage_staff', 'khalil_hybrid', 'it'),
  'edit_garage', (user_role IN ('owner', 'garage_manager') OR (capabilities IS NOT NULL AND 'garage' = ANY(capabilities))),
  'view_data_health', user_role IN ('owner', 'it', 'assistant', 'sales_ops', 'garage_manager'),
  'edit_data_health', (user_role = 'owner'),
  'manage_requests', user_role IN ('owner', 'assistant'),
  'manage_customers', user_role IN ('owner', 'sales_ops'),
  'manage_parts', (user_role IN ('owner', 'garage_manager') OR (capabilities IS NOT NULL AND 'garage' = ANY(capabilities)))
)
WHERE capabilities_jsonb = '{}'::jsonb OR capabilities_jsonb IS NULL;

-- 4) Sync employment_status with is_active for existing rows
UPDATE public.profiles
SET employment_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE (employment_status = 'active' AND NOT is_active) OR (employment_status IS NULL AND NOT is_active);

-- 5) Enable RLS on profiles (if not already)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6) RLS: All authenticated users can read profiles (for dropdowns, history, etc.)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 7) RLS: Users can update their own profile (limited fields - name, phone, etc.)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 8) RLS: Only owners can update other profiles (role, capabilities, is_active, employment_status)
DROP POLICY IF EXISTS "profiles_update_by_owner" ON public.profiles;
CREATE POLICY "profiles_update_by_owner" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND (p.user_role = 'owner' OR COALESCE((p.capabilities_jsonb->>'manage_team')::boolean, false) = true)
    )
  )
  WITH CHECK (true);

-- 9) RLS: Only owners can insert new profiles (for Add Employee flow - profile created after auth user)
DROP POLICY IF EXISTS "profiles_insert_by_owner" ON public.profiles;
CREATE POLICY "profiles_insert_by_owner" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND (p.user_role = 'owner' OR COALESCE((p.capabilities_jsonb->>'manage_team')::boolean, false) = true)
    )
  );

-- 10) Trigger: set updated_at and updated_by on profile update
CREATE OR REPLACE FUNCTION public.profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_updated_at();
