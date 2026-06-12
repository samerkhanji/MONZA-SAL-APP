-- ============================================
-- Monza S.A.L. — capture the drifted cars_sold_marker_when_sold CHECK (2026-06-12)
-- This constraint already exists in the live database but was created via the
-- dashboard and never recorded in a migration, so a fresh environment would
-- lack it. It enforces that any car marked status='sold' carries the
-- sold_marker='X' flag the UI relies on. The bulk Excel importer sets this
-- marker for sold rows; documenting the constraint here keeps schema and code
-- in sync. Idempotent.
-- ============================================

ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS cars_sold_marker_when_sold;
ALTER TABLE public.cars
  ADD CONSTRAINT cars_sold_marker_when_sold
  CHECK ((status <> 'sold'::car_status) OR (sold_marker = 'X'::text));
