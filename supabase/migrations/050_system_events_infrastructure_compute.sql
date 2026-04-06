-- Operational log (resize failures, alerts, etc.) and desired compute target for Management API retries.

CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_events_type_created_idx
  ON public.system_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS system_events_created_idx
  ON public.system_events (created_at DESC);

COMMENT ON TABLE public.system_events IS 'Append-only operational events (compute resize, alerts). Inserts from server API using service role.';

CREATE TABLE IF NOT EXISTS public.infrastructure_compute_target (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  desired_addon_type text NOT NULL DEFAULT 'compute_instance',
  desired_variant_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

INSERT INTO public.infrastructure_compute_target (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.infrastructure_compute_target IS 'Singleton row: target compute addon for Supabase Management API PATCH /billing/addons.';

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure_compute_target ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_events_select_owner" ON public.system_events;
CREATE POLICY "system_events_select_owner"
  ON public.system_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "infrastructure_compute_target_select_owner" ON public.infrastructure_compute_target;
CREATE POLICY "infrastructure_compute_target_select_owner"
  ON public.infrastructure_compute_target FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "infrastructure_compute_target_update_owner" ON public.infrastructure_compute_target;
CREATE POLICY "infrastructure_compute_target_update_owner"
  ON public.infrastructure_compute_target FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_role = 'owner'
    )
  );
