-- ============================================
-- MONZA CRM — cars deleted_at constraint + cleanup
-- Migration 059
--
-- Companion to 058. Now that 'scrapped' is a committed enum value, we
-- can use it in DML and add the integrity check.
--
-- Applied to prod via MCP on 2026-04-29 as
-- `cars_scrapped_constraint_and_cleanup`.
-- ============================================

-- Cleanup any soft-deleted rows that aren't really scrapped: bring back
-- to active inventory.
UPDATE public.cars
SET
  deleted_at = NULL,
  customer_id = NULL,
  updated_at = NOW()
WHERE deleted_at IS NOT NULL
  AND status IN ('inventory', 'available', 'reserved');

-- Mark remaining soft-deleted rows as scrapped.
UPDATE public.cars
SET
  status = 'scrapped'::public.car_status,
  updated_at = NOW()
WHERE deleted_at IS NOT NULL;

-- Integrity constraint: deleted_at may only be set when status=scrapped.
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
