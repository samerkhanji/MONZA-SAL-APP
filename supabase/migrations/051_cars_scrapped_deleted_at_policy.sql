-- Cars: soft-delete (deleted_at) only for physically scrapped units.
-- Return / resell must use customer unlink + status available (app layer), not deleted_at.

ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'scrapped';

-- In-stock rows that were incorrectly soft-deleted: bring back to active inventory
UPDATE public.cars
SET
  deleted_at = NULL,
  customer_id = NULL,
  updated_at = NOW()
WHERE deleted_at IS NOT NULL
  AND status IN ('inventory', 'available', 'reserved');

-- Any remaining soft-deleted row is treated as scrapped (vehicle removed from fleet)
UPDATE public.cars
SET
  status = 'scrapped'::public.car_status,
  updated_at = NOW()
WHERE deleted_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cars_deleted_at_requires_scrapped_status'
  ) THEN
    ALTER TABLE public.cars
      ADD CONSTRAINT cars_deleted_at_requires_scrapped_status
      CHECK (
        deleted_at IS NULL
        OR status = 'scrapped'::public.car_status
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT cars_deleted_at_requires_scrapped_status ON public.cars IS
  'deleted_at may only be set when status is scrapped. Operational return/resell clears customer_id and uses available, not deleted_at.';
