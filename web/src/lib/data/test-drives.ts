import type { TestDriveRow, TestDriveStatus } from "@/types/database";

export type TestDriveWithCar = TestDriveRow & {
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    status: string;
    current_km: number | null;
    battery_percent: number | null;
  } | null;
};

export async function fetchActiveTestDrives(
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<{ data: TestDriveWithCar[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("test_drives")
    .select(
      `
      *,
      cars:car_id (
        id,
        vin,
        brand,
        model,
        status,
        current_km,
        battery_percent
      )
    `
    )
    .eq("status", "out_for_test_drive")
    .order("test_drive_start_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data as TestDriveWithCar[]) ?? [], error: null };
}

export async function fetchRecentReturnedTestDrives(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  limit = 25
): Promise<{ data: TestDriveWithCar[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("test_drives")
    .select(
      `
      *,
      cars:car_id (
        id,
        vin,
        brand,
        model,
        status,
        current_km,
        battery_percent
      )
    `
    )
    .eq("status", "returned")
    .order("actual_return_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data as TestDriveWithCar[]) ?? [], error: null };
}

export async function fetchActiveTestDriveForCar(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  carId: string
): Promise<{ data: TestDriveRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("test_drives")
    .select("*")
    .eq("car_id", carId)
    .eq("status", "out_for_test_drive")
    .order("test_drive_start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TestDriveRow | null, error: null };
}

export async function fetchTestDriveById(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  id: string
): Promise<{ data: TestDriveWithCar | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("test_drives")
    .select(
      `
      *,
      cars:car_id (
        id,
        vin,
        brand,
        model,
        status,
        current_km,
        battery_percent
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data as TestDriveWithCar) ?? null, error: null };
}

export type TestDriveFormPayload = {
  car_id: string;
  vin: string;
  employee_user_id: string;
  employee_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: TestDriveStatus;
  test_drive_start_at: string;
  expected_return_at: string | null;
  actual_return_at: string | null;
  route: string | null;
  purpose: string | null;
  companion_employee: string | null;
  odometer_out: number | null;
  odometer_in: number | null;
  battery_out: number | null;
  battery_in: number | null;
  fuel_out: number | null;
  fuel_in: number | null;
  driver_license_checked: boolean;
  license_number: string | null;
  waiver_signed: boolean;
  incident_notes: string | null;
  notes: string | null;
  car_status_before_test_drive: string | null;
  updated_at: string;
};
