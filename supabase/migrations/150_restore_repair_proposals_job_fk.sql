-- Migration 150: restore the missing repair_proposals.job_id foreign key.
--
-- repair_proposals.job_id has always referenced garage_jobs(id), but when the
-- table was recreated with its expanded cost columns (total_parts_cost,
-- total_labor_cost, total_cost, approved_at, …) the FK constraint was lost.
-- Without it PostgREST cannot embed garage_jobs through job_id, so the
-- Assistant Dashboard "Repair Proposals" panel fails to load
-- (`garage_jobs:job_id(...)` returns an embed error).
--
-- Re-adding the constraint restores the embed and enforces referential
-- integrity. ON DELETE CASCADE matches the original design and the existing
-- garage_jobs.car_id -> cars cascade.

ALTER TABLE public.repair_proposals
  DROP CONSTRAINT IF EXISTS repair_proposals_job_id_fkey;

ALTER TABLE public.repair_proposals
  ADD CONSTRAINT repair_proposals_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.garage_jobs(id) ON DELETE CASCADE;
