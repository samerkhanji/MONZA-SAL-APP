-- ============================================
-- MONZA CRM — Test drives
-- Migration 034
--
-- App: /test-drive
-- Prerequisite: 027_rls_helper_functions.sql (public.is_any_role_resolved)
-- ============================================

-- Car status while vehicle is physically out on a test drive
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'test_drive';

CREATE TABLE IF NOT EXISTS public.test_drives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars (id) ON DELETE CASCADE,
  vin text NOT NULL,
  employee_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  employee_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'out_for_test_drive',
      'returned',
      'cancelled'
    )
  ),
  test_drive_start_at timestamptz NOT NULL DEFAULT now(),
  expected_return_at timestamptz,
  actual_return_at timestamptz,
  route text,
  purpose text,
  companion_employee text,
  odometer_out integer,
  odometer_in integer,
  battery_out integer,
  battery_in integer,
  fuel_out numeric(8, 2),
  fuel_in numeric(8, 2),
  driver_license_checked boolean NOT NULL DEFAULT false,
  license_number text,
  waiver_signed boolean NOT NULL DEFAULT false,
  incident_notes text,
  notes text,
  car_status_before_test_drive public.car_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: test_drives may already exist from an earlier partial run without this column
ALTER TABLE public.test_drives
  ADD COLUMN IF NOT EXISTS car_status_before_test_drive public.car_status;

COMMENT ON COLUMN public.test_drives.car_status_before_test_drive IS 'cars.status before checkout; restored when returned or cancelled.';

CREATE INDEX IF NOT EXISTS idx_test_drives_vin ON public.test_drives (vin);
CREATE INDEX IF NOT EXISTS idx_test_drives_car_id ON public.test_drives (car_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_employee_user_id ON public.test_drives (employee_user_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_status ON public.test_drives (status);
CREATE INDEX IF NOT EXISTS idx_test_drives_test_drive_start_at ON public.test_drives (test_drive_start_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_drives_one_active_out_per_car
  ON public.test_drives (car_id)
  WHERE status = 'out_for_test_drive';

-- Fast lookup: is this car currently out?
CREATE INDEX IF NOT EXISTS idx_test_drives_active_by_car
  ON public.test_drives (car_id)
  WHERE status = 'out_for_test_drive';

-- Helper: active test drive id for a car (null if none)
CREATE OR REPLACE FUNCTION public.active_test_drive_id_for_car(p_car_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT td.id
  FROM public.test_drives td
  WHERE td.car_id = p_car_id
    AND td.status = 'out_for_test_drive'
  ORDER BY td.test_drive_start_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.active_test_drive_id_for_car(uuid) IS 'Returns the id of the current out_for_test_drive row for a car, if any.';

ALTER TABLE public.test_drives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_drives_select_authenticated" ON public.test_drives;
CREATE POLICY "test_drives_select_authenticated"
  ON public.test_drives
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "test_drives_insert_sales_roles_self" ON public.test_drives;
CREATE POLICY "test_drives_insert_sales_roles_self"
  ON public.test_drives
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_user_id = auth.uid()
    AND public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "test_drives_update_sales_roles" ON public.test_drives;
CREATE POLICY "test_drives_update_sales_roles"
  ON public.test_drives
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "test_drives_delete_owner" ON public.test_drives;
CREATE POLICY "test_drives_delete_owner"
  ON public.test_drives
  FOR DELETE
  TO authenticated
  USING (
    public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

COMMENT ON TABLE public.test_drives IS 'Vehicle test drives; checkout/return workflow. UI: /test-drive.';
