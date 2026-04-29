-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424075722 as `garage_jobs_align_columns_to_code`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- garage_jobs has 0 rows — safe to rename/add without data migration.
-- Align schema to what the TS code expects.

-- 1. Rename existing columns to the names the code reads.
ALTER TABLE public.garage_jobs RENAME COLUMN job_status    TO status;
ALTER TABLE public.garage_jobs RENAME COLUMN internal_notes TO notes;
ALTER TABLE public.garage_jobs RENAME COLUMN opened_at     TO started_at;
ALTER TABLE public.garage_jobs RENAME COLUMN closed_at     TO completed_at;
ALTER TABLE public.garage_jobs RENAME COLUMN opened_by     TO created_by;

-- 2. Add columns the TS type expects.
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS title            text;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS description      text;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS delivered_at     timestamptz;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS actual_hours     numeric;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS overtime_notified boolean DEFAULT false;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS is_battery_only  boolean DEFAULT false;
ALTER TABLE public.garage_jobs ADD COLUMN IF NOT EXISTS work_checklist   jsonb   DEFAULT '[]'::jsonb;

-- 3. Update index names to match (non-breaking)
ALTER INDEX IF EXISTS idx_garage_jobs_opened_by RENAME TO idx_garage_jobs_created_by;

-- 4. Verify
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='garage_jobs'
 ORDER BY ordinal_position;
