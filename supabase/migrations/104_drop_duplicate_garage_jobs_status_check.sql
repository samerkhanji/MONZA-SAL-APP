-- ============================================================================
-- HOTFIX C-4: drop the duplicate, narrower CHECK on garage_jobs.status.
--
-- Two CHECKs were live:
--   garage_jobs_job_status_check  (wide, 8 values: pending, open, in_progress,
--                                  waiting_parts, ready, done, delivered,
--                                  cancelled) — the one the codebase
--                                  intends.
--   garage_jobs_status_in_enum   (narrow, 5 values: pending, in_progress,
--                                  waiting_parts, done, cancelled) — leftover
--                                  from an earlier migration that should
--                                  have been replaced, not added alongside.
--
-- Postgres enforces the conjunction, so the narrow check wins. Writes of
-- 'open', 'ready', and 'delivered' (used by the auto-create trigger,
-- FinishJobDialog, the delivery handover, etc.) all failed at the DB layer.
--
-- This migration drops the narrow one so the intended wide set is enforced.
-- ============================================================================

ALTER TABLE public.garage_jobs
  DROP CONSTRAINT IF EXISTS garage_jobs_status_in_enum;
