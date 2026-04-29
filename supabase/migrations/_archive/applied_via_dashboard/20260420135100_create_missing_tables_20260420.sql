-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420135100 as `create_missing_tables_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Phase 1: Create the 7 tables the code references but don't exist.

-- 1. system_events (append-only ops log)
CREATE TABLE IF NOT EXISTS public.system_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','warning','error','critical')),
  message     text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_events_created_idx
  ON public.system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_type_idx
  ON public.system_events (event_type, created_at DESC);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_events_select_owner" ON public.system_events;
CREATE POLICY "system_events_select_owner" ON public.system_events
  FOR SELECT TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));
-- Inserts/updates only via service role (no policies needed; writes will be from server).

-- 2. task_timers (one open timer per user per task)
CREATE TABLE IF NOT EXISTS public.task_timers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid NOT NULL REFERENCES public.garage_tasks(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  start_time       timestamptz NOT NULL DEFAULT now(),
  end_time         timestamptz,
  duration_seconds integer
);
CREATE UNIQUE INDEX IF NOT EXISTS task_timers_one_open_per_user_task
  ON public.task_timers (task_id, user_id) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS task_timers_user_idx ON public.task_timers (user_id);
CREATE INDEX IF NOT EXISTS task_timers_task_idx ON public.task_timers (task_id);

ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_timers_select_own_or_mgmt" ON public.task_timers;
CREATE POLICY "task_timers_select_own_or_mgmt" ON public.task_timers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner','garage_manager','assistant']::public.user_role[])
  );
DROP POLICY IF EXISTS "task_timers_insert_own" ON public.task_timers;
CREATE POLICY "task_timers_insert_own" ON public.task_timers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "task_timers_update_own" ON public.task_timers;
CREATE POLICY "task_timers_update_own" ON public.task_timers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. page_access_requests
CREATE TABLE IF NOT EXISTS public.page_access_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','denied')),
  reviewed_by   uuid REFERENCES public.profiles(id),
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_access_requests_status_idx
  ON public.page_access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS page_access_requests_requester_idx
  ON public.page_access_requests (requested_by, page_name);

ALTER TABLE public.page_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_access_select_own_or_owner" ON public.page_access_requests;
CREATE POLICY "page_access_select_own_or_owner" ON public.page_access_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );
DROP POLICY IF EXISTS "page_access_insert_own" ON public.page_access_requests;
CREATE POLICY "page_access_insert_own" ON public.page_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());
DROP POLICY IF EXISTS "page_access_update_owner" ON public.page_access_requests;
CREATE POLICY "page_access_update_owner" ON public.page_access_requests
  FOR UPDATE TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner']::public.user_role[]));

-- 4. accessory_custom_tables
CREATE TABLE IF NOT EXISTS public.accessory_custom_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. accessory_custom_items
CREATE TABLE IF NOT EXISTS public.accessory_custom_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       uuid NOT NULL REFERENCES public.accessory_custom_tables(id) ON DELETE CASCADE,
  label          text NOT NULL,
  quantity       integer NOT NULL DEFAULT 0,
  note           text,
  linked_plate   text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accessory_custom_items_table_idx
  ON public.accessory_custom_items (table_id, sort_order);

ALTER TABLE public.accessory_custom_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessory_custom_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acc_custom_tables_select" ON public.accessory_custom_tables;
CREATE POLICY "acc_custom_tables_select" ON public.accessory_custom_tables
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "acc_custom_tables_write" ON public.accessory_custom_tables;
CREATE POLICY "acc_custom_tables_write" ON public.accessory_custom_tables
  FOR ALL TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS "acc_custom_items_select" ON public.accessory_custom_items;
CREATE POLICY "acc_custom_items_select" ON public.accessory_custom_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "acc_custom_items_write" ON public.accessory_custom_items;
CREATE POLICY "acc_custom_items_write" ON public.accessory_custom_items
  FOR ALL TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]));

-- 6. garage_job_bay_context
CREATE TABLE IF NOT EXISTS public.garage_job_bay_context (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  bay_type     text NOT NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS garage_job_bay_context_job_type_unique
  ON public.garage_job_bay_context (job_id, bay_type);

ALTER TABLE public.garage_job_bay_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gjbc_select_staff" ON public.garage_job_bay_context;
CREATE POLICY "gjbc_select_staff" ON public.garage_job_bay_context
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "gjbc_write_garage" ON public.garage_job_bay_context;
CREATE POLICY "gjbc_write_garage" ON public.garage_job_bay_context
  FOR ALL TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner','garage_manager','garage_staff','assistant']::public.user_role[]));

-- updated_at auto-touchers
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS acc_custom_tables_touch ON public.accessory_custom_tables;
CREATE TRIGGER acc_custom_tables_touch BEFORE UPDATE ON public.accessory_custom_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS acc_custom_items_touch ON public.accessory_custom_items;
CREATE TRIGGER acc_custom_items_touch BEFORE UPDATE ON public.accessory_custom_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS gjbc_touch ON public.garage_job_bay_context;
CREATE TRIGGER gjbc_touch BEFORE UPDATE ON public.garage_job_bay_context
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
