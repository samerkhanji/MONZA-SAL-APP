-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420135119 as `rename_tables_to_match_code_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Phase 2: Rename tables to the names the code expects.
-- Both tables are 0-row so no data movement concerns.

-- Keep old name as view for backward compatibility in case anything else points at it.
ALTER TABLE public.time_entries   RENAME TO job_time_entries;
ALTER TABLE public.proposal_items RENAME TO repair_proposal_items;

-- Optional aliases so any lingering queries at the old names don't error silently.
CREATE OR REPLACE VIEW public.time_entries   WITH (security_invoker = on) AS SELECT * FROM public.job_time_entries;
CREATE OR REPLACE VIEW public.proposal_items WITH (security_invoker = on) AS SELECT * FROM public.repair_proposal_items;
