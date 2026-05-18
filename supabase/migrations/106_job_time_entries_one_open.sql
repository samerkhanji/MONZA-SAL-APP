-- ============================================================================
-- HOTFIX C-7: enforce one open time entry per (job_id, user_id).
--
-- Pre-hotfix: JobTimeEntryControls.handleStartOrResume inserted a new entry
-- without first checking if an open one existed. Clicking "Start" twice in
-- quick succession (or opening in two tabs) created two `ended_at IS NULL`
-- rows; pause closes only one; the other accumulates duration forever.
--
-- This partial unique index makes the race impossible at the DB layer.
-- Paired with a UI fix in JobTimeEntryControls.tsx that translates the
-- resulting 23505 into "A timer is already running for this job".
--
-- Verified open-duplicate count at apply time: 0.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_time_entries_one_open_per_user
  ON public.job_time_entries (job_id, user_id)
  WHERE ended_at IS NULL;
