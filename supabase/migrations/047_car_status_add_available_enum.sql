-- Step 1 of 2: add `available` to car_status (must commit before rows may use it).
ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'available';
