-- ============================================================================
-- HOTFIX C-12: server-side validation on test_drives.
--
-- Pre-hotfix: every numeric field (battery_in/out, odometer_in/out, fuel_in/out)
-- was a plain integer/numeric column with no CHECK. UI also did not validate.
-- A staff member could record a return odometer LESS than the start odometer,
-- a battery percentage of 250 or -5, or an actual_return_at BEFORE the
-- test_drive_start_at — and the row would persist silently.
--
-- This migration adds CHECKs that match the physical reality of an EV/ICE
-- inspection sheet. UI validation is added in a paired commit so users see
-- a clean toast before submitting instead of a raw 23514 error.
--
-- Verified rows-in-violation count was 0 across the table at apply time.
-- ============================================================================

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_battery_out_range
  CHECK (battery_out IS NULL OR (battery_out BETWEEN 0 AND 100));

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_battery_in_range
  CHECK (battery_in IS NULL OR (battery_in BETWEEN 0 AND 100));

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_fuel_out_range
  CHECK (fuel_out IS NULL OR (fuel_out BETWEEN 0 AND 100));

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_fuel_in_range
  CHECK (fuel_in IS NULL OR (fuel_in BETWEEN 0 AND 100));

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_odometer_out_nonneg
  CHECK (odometer_out IS NULL OR odometer_out >= 0);

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_odometer_in_nonneg
  CHECK (odometer_in IS NULL OR odometer_in >= 0);

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_odometer_direction
  CHECK (
    odometer_in IS NULL
    OR odometer_out IS NULL
    OR odometer_in >= odometer_out
  );

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_return_after_start
  CHECK (
    actual_return_at IS NULL
    OR actual_return_at >= test_drive_start_at
  );
