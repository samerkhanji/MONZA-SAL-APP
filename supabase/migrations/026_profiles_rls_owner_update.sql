-- ============================================
-- MONZA CRM - Fix profiles RLS for owner updates
-- Migration 026: Allow active owners to update any profile
-- Uses user_role only (no JSON operators on capabilities)
-- ============================================

-- Create profile when auth user is created (for Add Employee flow)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap_array TEXT[];
BEGIN
  IF NEW.raw_user_meta_data ? 'capabilities' AND jsonb_typeof(NEW.raw_user_meta_data->'capabilities') = 'array' THEN
    SELECT array_agg(elem::text) INTO cap_array
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'capabilities') elem;
  ELSE
    cap_array := '{}';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    user_role,
    capabilities,
    is_active,
    employment_status,
    job_title,
    department
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'assistant'),
    COALESCE((NEW.raw_user_meta_data->>'user_role')::public.user_role, 'assistant'),
    cap_array,
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true),
    COALESCE(NEW.raw_user_meta_data->>'employment_status', 'active'),
    NEW.raw_user_meta_data->>'job_title',
    NEW.raw_user_meta_data->>'department'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    user_role = EXCLUDED.user_role,
    capabilities = EXCLUDED.capabilities,
    is_active = EXCLUDED.is_active,
    employment_status = EXCLUDED.employment_status,
    job_title = EXCLUDED.job_title,
    department = EXCLUDED.department;
  RETURN NEW;
EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    INSERT INTO public.profiles (id, full_name, email, phone, role, is_active, employment_status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      'assistant',
      true,
      'active'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_for_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_for_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Drop existing owner policies that reference capabilities_jsonb
DROP POLICY IF EXISTS "profiles_update_by_owner" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_owner" ON public.profiles;

-- Owners (user_role = 'owner') can update any profile
CREATE POLICY "profiles_update_by_owner" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.user_role = 'owner'
    )
  )
  WITH CHECK (true);

-- Owners can insert new profiles (Add Employee flow)
CREATE POLICY "profiles_insert_by_owner" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.user_role = 'owner'
    )
  );
