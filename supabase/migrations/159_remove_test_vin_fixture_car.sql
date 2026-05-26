-- Soft-delete the leftover demo car with VIN 'TESTVIN12345678901'.
-- The row was a fixture whose fields are mostly NULL, so it renders as a
-- broken row in the cars inventory. The cars list filters by
-- deleted_at IS NULL (see lib/data/cars.ts), so a soft delete removes
-- it from every view while preserving downstream history rows
-- (car_events, car_warranties).
-- The cars_deleted_at_requires_scrapped_status CHECK requires that
-- deleted rows carry status='scrapped', so we set both in one update.
UPDATE public.cars
SET status = 'scrapped',
    deleted_at = NOW()
WHERE vin = 'TESTVIN12345678901'
  AND deleted_at IS NULL;
