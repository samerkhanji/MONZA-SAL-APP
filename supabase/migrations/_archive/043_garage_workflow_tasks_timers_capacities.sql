-- ============================================
-- MONZA CRM — Garage workflow: tasks, timers, templates, capacities
-- Roles: owner, garage_manager (full), garage_staff (assigned tasks + own timers)
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.garage_task_status AS ENUM (
    'pending',
    'in_progress',
    'blocked',
    'done',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.garage_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.garage_task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.garage_task_templates (id) ON DELETE CASCADE,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  default_resource_type text
);

CREATE TABLE IF NOT EXISTS public.garage_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars (id) ON DELETE CASCADE,
  description text NOT NULL,
  status public.garage_task_status NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  resource_type text,
  template_item_id uuid REFERENCES public.garage_task_template_items (id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.garage_tasks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_seconds int
);

CREATE UNIQUE INDEX IF NOT EXISTS task_timers_one_open_per_user_task
  ON public.task_timers (task_id, user_id)
  WHERE end_time IS NULL;

CREATE TABLE IF NOT EXISTS public.garage_capacities (
  resource_name text PRIMARY KEY,
  capacity int NOT NULL CHECK (capacity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.garage_tasks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garage_tasks_set_updated_at ON public.garage_tasks;
CREATE TRIGGER garage_tasks_set_updated_at
  BEFORE UPDATE ON public.garage_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.garage_tasks_set_updated_at();

INSERT INTO public.garage_capacities (resource_name, capacity)
VALUES
  ('bays', 4),
  ('pit', 1),
  ('car_wash', 1),
  ('oven', 1),
  ('car_painting', 2),
  ('ev_bays', 2),
  ('body_work', 2),
  ('battery_lab', 1),
  ('polish', 1)
ON CONFLICT (resource_name) DO NOTHING;

DO $$
DECLARE
  tid uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.garage_task_templates WHERE name = 'Standard service' AND is_system = true
  ) THEN
    INSERT INTO public.garage_task_templates (name, is_system, created_by)
    VALUES ('Standard service', true, NULL)
    RETURNING id INTO tid;

    INSERT INTO public.garage_task_template_items (template_id, description, sort_order, default_resource_type)
    VALUES
      (tid, 'Vehicle intake & diagnostic', 0, 'bays'),
      (tid, 'Bay service work', 1, 'bays'),
      (tid, 'Quality / pit check', 2, 'pit');
  END IF;
END $$;

ALTER TABLE public.garage_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_task_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_capacities ENABLE ROW LEVEL SECURITY;

-- garage_task_templates
DROP POLICY IF EXISTS garage_task_templates_select_auth ON public.garage_task_templates;
CREATE POLICY garage_task_templates_select_auth
  ON public.garage_task_templates FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS garage_task_templates_insert_mgmt ON public.garage_task_templates;
CREATE POLICY garage_task_templates_insert_mgmt
  ON public.garage_task_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_task_templates_update_mgmt ON public.garage_task_templates;
CREATE POLICY garage_task_templates_update_mgmt
  ON public.garage_task_templates FOR UPDATE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_task_templates_delete_mgmt ON public.garage_task_templates;
CREATE POLICY garage_task_templates_delete_mgmt
  ON public.garage_task_templates FOR DELETE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

-- garage_task_template_items
DROP POLICY IF EXISTS garage_task_template_items_select_auth ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_select_auth
  ON public.garage_task_template_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS garage_task_template_items_insert_mgmt ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_insert_mgmt
  ON public.garage_task_template_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_task_template_items_update_mgmt ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_update_mgmt
  ON public.garage_task_template_items FOR UPDATE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_task_template_items_delete_mgmt ON public.garage_task_template_items;
CREATE POLICY garage_task_template_items_delete_mgmt
  ON public.garage_task_template_items FOR DELETE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

-- garage_tasks
DROP POLICY IF EXISTS garage_tasks_select_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_select_mgmt
  ON public.garage_tasks FOR SELECT
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_tasks_select_assigned ON public.garage_tasks;
CREATE POLICY garage_tasks_select_assigned
  ON public.garage_tasks FOR SELECT
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'garage_staff'::public.user_role
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  );

DROP POLICY IF EXISTS garage_tasks_insert_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_insert_mgmt
  ON public.garage_tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_tasks_update_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_update_mgmt
  ON public.garage_tasks FOR UPDATE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

DROP POLICY IF EXISTS garage_tasks_update_assigned_staff ON public.garage_tasks;
CREATE POLICY garage_tasks_update_assigned_staff
  ON public.garage_tasks FOR UPDATE
  TO authenticated
  USING (
    public.get_my_user_role_resolved() = 'garage_staff'::public.user_role
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    public.get_my_user_role_resolved() = 'garage_staff'::public.user_role
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  );

DROP POLICY IF EXISTS garage_tasks_delete_mgmt ON public.garage_tasks;
CREATE POLICY garage_tasks_delete_mgmt
  ON public.garage_tasks FOR DELETE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

-- task_timers
DROP POLICY IF EXISTS task_timers_select_own_or_mgmt ON public.task_timers;
CREATE POLICY task_timers_select_own_or_mgmt
  ON public.task_timers FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[])
  );

DROP POLICY IF EXISTS task_timers_insert_own ON public.task_timers;
CREATE POLICY task_timers_insert_own
  ON public.task_timers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS task_timers_update_own_open ON public.task_timers;
CREATE POLICY task_timers_update_own_open
  ON public.task_timers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND end_time IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS task_timers_delete_mgmt ON public.task_timers;
CREATE POLICY task_timers_delete_mgmt
  ON public.task_timers FOR DELETE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

-- garage_capacities
DROP POLICY IF EXISTS garage_capacities_select_auth ON public.garage_capacities;
CREATE POLICY garage_capacities_select_auth
  ON public.garage_capacities FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS garage_capacities_update_mgmt ON public.garage_capacities;
CREATE POLICY garage_capacities_update_mgmt
  ON public.garage_capacities FOR UPDATE
  TO authenticated
  USING (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]))
  WITH CHECK (public.is_any_role_resolved(ARRAY['owner', 'garage_manager']::public.user_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_task_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_task_template_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_timers TO authenticated;
GRANT SELECT, UPDATE ON public.garage_capacities TO authenticated;
