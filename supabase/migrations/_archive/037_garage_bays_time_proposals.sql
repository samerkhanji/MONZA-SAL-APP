-- Phase 2: Garage bays, time entries, repair proposals, bay context, job bay link

-- ---------------------------------------------------------------------------
-- 1) garage_bays
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garage_bays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  bay_type TEXT NOT NULL CHECK (bay_type IN (
    'normal', 'pit', 'car_wash', 'oven', 'paint', 'ev', 'body_work', 'battery_lab', 'polish'
  )),
  capacity INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bay_number)
);

CREATE INDEX IF NOT EXISTS idx_garage_bays_type_active ON public.garage_bays (bay_type, is_active);
CREATE INDEX IF NOT EXISTS idx_garage_bays_active ON public.garage_bays (is_active) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- 2) garage_jobs: bay link, battery-only jobs, checklist JSON
-- ---------------------------------------------------------------------------
ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS garage_bay_id UUID REFERENCES public.garage_bays(id) ON DELETE SET NULL;

ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS is_battery_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS work_checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.garage_jobs ALTER COLUMN car_id DROP NOT NULL;

ALTER TABLE public.garage_jobs DROP CONSTRAINT IF EXISTS garage_jobs_car_or_battery;
ALTER TABLE public.garage_jobs ADD CONSTRAINT garage_jobs_car_or_battery CHECK (
  (COALESCE(is_battery_only, FALSE) = FALSE AND car_id IS NOT NULL)
  OR (COALESCE(is_battery_only, FALSE) = TRUE AND car_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_garage_jobs_one_active_per_bay
  ON public.garage_jobs (garage_bay_id)
  WHERE garage_bay_id IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('done', 'delivered', 'cancelled');

-- ---------------------------------------------------------------------------
-- 3) job_time_entries (mechanic sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_time_entries_job ON public.job_time_entries (job_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_open ON public.job_time_entries (job_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4) garage_job_bay_context (paint / oven / wash / polish / battery lab)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garage_job_bay_context (
  job_id UUID PRIMARY KEY REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  paint_color TEXT,
  paint_started_at TIMESTAMPTZ,
  paint_ended_at TIMESTAMPTZ,
  oven_temp_c NUMERIC(6,2),
  oven_started_at TIMESTAMPTZ,
  oven_ended_at TIMESTAMPTZ,
  wash_type TEXT CHECK (wash_type IS NULL OR wash_type IN ('exterior', 'interior', 'full', 'detail')),
  wash_started_at TIMESTAMPTZ,
  wash_ended_at TIMESTAMPTZ,
  polish_type TEXT,
  polish_started_at TIMESTAMPTZ,
  polish_ended_at TIMESTAMPTZ,
  battery_health_pct NUMERIC(5,2),
  battery_test_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5) repair_proposals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repair_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'sent_to_customer_service',
    'sent_to_customer',
    'partially_approved',
    'fully_approved',
    'rejected'
  )),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_proposals_job ON public.repair_proposals (job_id);
CREATE INDEX IF NOT EXISTS idx_repair_proposals_status ON public.repair_proposals (status);

CREATE TABLE IF NOT EXISTS public.repair_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.repair_proposals(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('part', 'labor', 'service')),
  name TEXT NOT NULL,
  part_number TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_decision TEXT NOT NULL DEFAULT 'pending' CHECK (customer_decision IN ('pending', 'approved', 'declined')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_proposal_items_proposal ON public.repair_proposal_items (proposal_id);

-- ---------------------------------------------------------------------------
-- 6) Seed 16 bays (idempotent: skip if any row exists)
-- ---------------------------------------------------------------------------
INSERT INTO public.garage_bays (bay_number, name, bay_type, capacity, description, sort_order)
SELECT * FROM (VALUES
  (1, 'Normal Bay 1', 'normal', 4, 'General maintenance & repair', 1),
  (2, 'Normal Bay 2', 'normal', 4, 'General maintenance & repair', 2),
  (3, 'Normal Bay 3', 'normal', 4, 'General maintenance & repair', 3),
  (4, 'Normal Bay 4', 'normal', 4, 'General maintenance & repair', 4),
  (5, 'Oil Change Pit', 'pit', 1, 'Pit for oil changes', 5),
  (6, 'Car Wash', 'car_wash', 1, 'Car washing station', 6),
  (7, 'Oven', 'oven', 1, 'Paint drying oven', 7),
  (8, 'Paint Bay 1', 'paint', 2, 'Car painting booth', 8),
  (9, 'Paint Bay 2', 'paint', 2, 'Car painting booth', 9),
  (10, 'EV Bay 1', 'ev', 2, 'Electric vehicle diagnostics & repair', 10),
  (11, 'EV Bay 2', 'ev', 2, 'Electric vehicle diagnostics & repair', 11),
  (12, 'Body Work 1', 'body_work', 2, 'Body repair & panel work', 12),
  (13, 'Body Work 2', 'body_work', 2, 'Body repair & panel work', 13),
  (14, 'Battery Lab 1', 'battery_lab', 2, 'Battery testing & repair (no vehicle)', 14),
  (15, 'Battery Lab 2', 'battery_lab', 2, 'Battery testing & repair (no vehicle)', 15),
  (16, 'Polish Bay', 'polish', 1, 'Car polishing & detailing', 16)
) AS v(bay_number, name, bay_type, capacity, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.garage_bays LIMIT 1);

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.garage_bays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_job_bay_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_proposal_items ENABLE ROW LEVEL SECURITY;

-- garage_bays: read all authenticated; insert/update manager roles; deactivate owner in app (same policy)
DROP POLICY IF EXISTS "garage_bays_select_auth" ON public.garage_bays;
CREATE POLICY "garage_bays_select_auth" ON public.garage_bays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "garage_bays_insert_mgr" ON public.garage_bays;
CREATE POLICY "garage_bays_insert_mgr" ON public.garage_bays
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_any_role(ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[])
  );

DROP POLICY IF EXISTS "garage_bays_update_mgr" ON public.garage_bays;
CREATE POLICY "garage_bays_update_mgr" ON public.garage_bays
  FOR UPDATE TO authenticated
  USING (
    public.is_any_role(ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[])
  )
  WITH CHECK (
    public.is_any_role(ARRAY['owner','garage_manager','khalil_hybrid']::public.user_role[])
  );

-- job_time_entries
DROP POLICY IF EXISTS "job_time_entries_select" ON public.job_time_entries;
CREATE POLICY "job_time_entries_select" ON public.job_time_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = job_time_entries.job_id
        AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "job_time_entries_insert" ON public.job_time_entries;
CREATE POLICY "job_time_entries_insert" ON public.job_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','garage_manager','garage_staff']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "job_time_entries_update" ON public.job_time_entries;
CREATE POLICY "job_time_entries_update" ON public.job_time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- bay context
DROP POLICY IF EXISTS "garage_job_bay_context_select" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_select" ON public.garage_job_bay_context
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = garage_job_bay_context.job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "garage_job_bay_context_insert" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_insert" ON public.garage_job_bay_context
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "garage_job_bay_context_update" ON public.garage_job_bay_context;
CREATE POLICY "garage_job_bay_context_update" ON public.garage_job_bay_context
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = garage_job_bay_context.job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

-- repair proposals
DROP POLICY IF EXISTS "repair_proposals_select" ON public.repair_proposals;
CREATE POLICY "repair_proposals_select" ON public.repair_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garage_jobs j
      WHERE j.id = repair_proposals.job_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "repair_proposals_insert" ON public.repair_proposals;
CREATE POLICY "repair_proposals_insert" ON public.repair_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "repair_proposals_update_gm" ON public.repair_proposals;
CREATE POLICY "repair_proposals_update_gm" ON public.repair_proposals
  FOR UPDATE TO authenticated
  USING (public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS "repair_proposals_update_asst" ON public.repair_proposals;
CREATE POLICY "repair_proposals_update_asst" ON public.repair_proposals
  FOR UPDATE TO authenticated
  USING (public.is_role('assistant'))
  WITH CHECK (public.is_role('assistant'));

DROP POLICY IF EXISTS "repair_proposal_items_select" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_select" ON public.repair_proposal_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      JOIN public.garage_jobs j ON j.id = p.job_id
      WHERE p.id = repair_proposal_items.proposal_id AND j.deleted_at IS NULL
        AND (
          public.is_any_role(ARRAY['owner','assistant','garage_manager','khalil_hybrid']::public.user_role[])
          OR j.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_insert" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_insert" ON public.repair_proposal_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      WHERE p.id = proposal_id
        AND public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_update_gm" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_update_gm" ON public.repair_proposal_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      WHERE p.id = proposal_id
        AND public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_update_asst" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_update_asst" ON public.repair_proposal_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      WHERE p.id = proposal_id AND public.is_role('assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      WHERE p.id = proposal_id AND public.is_role('assistant')
    )
  );

DROP POLICY IF EXISTS "repair_proposal_items_delete" ON public.repair_proposal_items;
CREATE POLICY "repair_proposal_items_delete" ON public.repair_proposal_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_proposals p
      WHERE p.id = proposal_id
        AND public.is_any_role(ARRAY['owner','garage_manager']::public.user_role[])
    )
  );

COMMENT ON TABLE public.garage_bays IS 'Physical workshop bays; dynamic add via UI for manager roles.';
COMMENT ON TABLE public.job_time_entries IS 'Mechanic work sessions (start/pause/stop).';
COMMENT ON TABLE public.repair_proposals IS 'Garage repair proposal workflow with CS/assistant steps.';
