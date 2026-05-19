-- ============================================================================
-- HOTFIX C-5 + C-6: make garage_jobs.car_id nullable, add external assignee.
--
-- C-5: car_id was NOT NULL but the "Battery only" path in NewJobDialog inserts
-- car_id=null. Battery-lab work is a legitimate Mark workflow, so the fix is
-- to allow NULL (downstream code uses LEFT JOIN, verified).
--
-- C-6: assigned_to is a uuid FK to profiles(id). The UI was sending free-text
-- names like "Mark" or "External Mechanic" -> 23503 FK violation on every
-- assignee insert. Internal mechanics (Mark, Suhail, Khalil, owners) DO
-- exist in profiles, so the right answer is a profile picker for internal
-- AND a separate text column for legitimate external mechanics.
--
-- Adds external_assignee_name text column (nullable).
-- Adds CHECK garage_jobs_assignee_xor: at most one of
--   (assigned_to, external_assignee_name) is set. Both NULL = unassigned.
--
-- Verified with end-to-end smoke test against prod:
--   car_id NULL                                  ACCEPTED
--   internal-only assignee                       ACCEPTED
--   external-only assignee                       ACCEPTED
--   both set                                     REJECTED (check_violation)
--   neither set (unassigned)                     ACCEPTED
-- ============================================================================

ALTER TABLE public.garage_jobs
  ALTER COLUMN car_id DROP NOT NULL;

ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS external_assignee_name text;

ALTER TABLE public.garage_jobs
  DROP CONSTRAINT IF EXISTS garage_jobs_assignee_xor;

ALTER TABLE public.garage_jobs
  ADD CONSTRAINT garage_jobs_assignee_xor
  CHECK (
    assigned_to IS NULL
    OR external_assignee_name IS NULL
  );

COMMENT ON COLUMN public.garage_jobs.external_assignee_name IS
  'Free-text name for an external mechanic. Mutually exclusive with assigned_to (FK to profiles). Both NULL = unassigned.';
