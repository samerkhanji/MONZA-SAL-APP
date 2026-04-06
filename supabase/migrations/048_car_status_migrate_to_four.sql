-- Step 2 of 2: migrate all cars and test-drive snapshots to four statuses only.

UPDATE public.cars
SET status = CASE
  WHEN status::text IN ('sold', 'delivered') THEN 'sold'::public.car_status
  WHEN status::text = 'reserved' THEN 'reserved'::public.car_status
  WHEN status::text IN ('inbound', 'inventory') THEN 'inventory'::public.car_status
  ELSE 'available'::public.car_status
END;

ALTER TABLE public.cars ALTER COLUMN status SET DEFAULT 'inventory';

UPDATE public.test_drives
SET car_status_before_test_drive = CASE
  WHEN car_status_before_test_drive::text IN ('sold', 'delivered') THEN 'sold'::public.car_status
  WHEN car_status_before_test_drive::text = 'reserved' THEN 'reserved'::public.car_status
  WHEN car_status_before_test_drive::text IN ('inbound', 'inventory') THEN 'inventory'::public.car_status
  ELSE 'available'::public.car_status
END
WHERE car_status_before_test_drive IS NOT NULL;
