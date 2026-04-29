-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260425083838 as `garage_workflow_buildout`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- ================================================================
-- GARAGE WORKFLOW BUILDOUT
-- Adds: bay_assignment_history, snapshot cols on job_parts, bay timing
--       on garage_jobs, bay status state machine.
-- New RPCs: scan_vin_to_bay, release_bay, apply_part_to_job,
--           return_part_from_job.
-- Trigger: auto-recompute garage_jobs.actual_hours from job_time_entries.
-- Views: garage_job_efficiency, garage_bay_utilization,
--        garage_employee_efficiency.
-- ================================================================

-- 1. Schema additions ------------------------------------------------------

-- garage_bays status state machine
UPDATE public.garage_bays
   SET status = 'empty'
 WHERE status IS NULL
    OR status NOT IN ('empty','occupied','cleaning','maintenance');

ALTER TABLE public.garage_bays DROP CONSTRAINT IF EXISTS garage_bays_status_check;
ALTER TABLE public.garage_bays
  ADD CONSTRAINT garage_bays_status_check
  CHECK (status IN ('empty','occupied','cleaning','maintenance'));
ALTER TABLE public.garage_bays ALTER COLUMN status SET DEFAULT 'empty';

-- garage_jobs: bay-level timing
ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS bay_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS bay_exited_at  timestamptz;

-- job_parts: snapshot cost at time of use
ALTER TABLE public.job_parts
  ADD COLUMN IF NOT EXISTS unit_cost_snapshot numeric,
  ADD COLUMN IF NOT EXISTS currency_snapshot  text,
  ADD COLUMN IF NOT EXISTS used_at            timestamptz DEFAULT now();

-- 2. Bay assignment audit log ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.bay_assignment_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_id        integer NOT NULL REFERENCES public.garage_bays(id) ON DELETE CASCADE,
  job_id        uuid    REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  car_id        uuid    REFERENCES public.cars(id)        ON DELETE SET NULL,
  vin           text,
  event_type    text NOT NULL CHECK (event_type IN ('entered','exited','status_change')),
  bay_status_before text,
  bay_status_after  text,
  note          text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bah_bay ON public.bay_assignment_history(bay_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bah_job ON public.bay_assignment_history(job_id);
CREATE INDEX IF NOT EXISTS idx_bah_car ON public.bay_assignment_history(car_id);

ALTER TABLE public.bay_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bay_history_select" ON public.bay_assignment_history;
CREATE POLICY "bay_history_select" ON public.bay_assignment_history
  FOR SELECT TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','garage_manager','garage_staff','hybrid']::public.user_role[]
    )
  );
-- Inserts come exclusively from the SECURITY DEFINER RPCs below.

-- 3. RPC: scan_vin_to_bay --------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_vin_to_bay(
  p_vin    text,
  p_bay_id integer,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS public.garage_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_car public.cars;
  v_bay public.garage_bays;
  v_job public.garage_jobs;
BEGIN
  SELECT * INTO v_car
    FROM public.cars
   WHERE vin = p_vin AND deleted_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No car found with VIN %', p_vin USING ERRCODE = '02000';
  END IF;

  SELECT * INTO v_bay FROM public.garage_bays WHERE id = p_bay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bay % not found', p_bay_id USING ERRCODE = '02000';
  END IF;
  IF v_bay.is_active = false THEN
    RAISE EXCEPTION 'Bay % is inactive', p_bay_id USING ERRCODE = '23P01';
  END IF;
  IF v_bay.current_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bay % already occupied by job %', p_bay_id, v_bay.current_job_id USING ERRCODE = '23P01';
  END IF;

  -- Find an existing open job for this car not already on a different bay
  SELECT * INTO v_job
    FROM public.garage_jobs
   WHERE car_id = v_car.id
     AND deleted_at IS NULL
     AND status IN ('pending','in_progress','waiting_parts')
     AND (garage_bay_id IS NULL OR garage_bay_id = p_bay_id)
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.garage_jobs (
      car_id, customer_id, status, started_at,
      garage_bay_id, bay_entered_at, created_by, assigned_to,
      title, complaint, priority
    ) VALUES (
      v_car.id, v_car.customer_id, 'in_progress', now(),
      p_bay_id, now(), p_user_id, p_user_id,
      'Service - ' || COALESCE(v_car.brand,'') || ' ' || COALESCE(v_car.model,''),
      'Walk-in scan',
      'normal'
    )
    RETURNING * INTO v_job;
  ELSE
    UPDATE public.garage_jobs
       SET garage_bay_id  = p_bay_id,
           bay_entered_at = now(),
           status         = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
           started_at     = COALESCE(started_at, now()),
           assigned_to    = COALESCE(assigned_to, p_user_id),
           updated_at     = now()
     WHERE id = v_job.id
     RETURNING * INTO v_job;
  END IF;

  UPDATE public.garage_bays
     SET current_job_id = v_job.id,
         status         = 'occupied',
         updated_at     = now()
   WHERE id = p_bay_id;

  INSERT INTO public.bay_assignment_history (
    bay_id, job_id, car_id, vin, event_type,
    bay_status_before, bay_status_after, created_by
  ) VALUES (
    p_bay_id, v_job.id, v_car.id, p_vin, 'entered',
    v_bay.status, 'occupied', p_user_id
  );

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_vin_to_bay(text, integer, uuid) TO authenticated;

-- 4. RPC: release_bay -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_bay(
  p_bay_id          integer,
  p_user_id         uuid   DEFAULT auth.uid(),
  p_new_job_status  text   DEFAULT NULL,
  p_set_bay_status  text   DEFAULT 'empty'
)
RETURNS public.garage_bays
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bay public.garage_bays;
  v_job public.garage_jobs;
  v_vin text;
BEGIN
  IF p_set_bay_status NOT IN ('empty','cleaning','maintenance') THEN
    RAISE EXCEPTION 'Invalid bay status %', p_set_bay_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bay FROM public.garage_bays WHERE id = p_bay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bay % not found', p_bay_id USING ERRCODE = '02000';
  END IF;

  IF v_bay.current_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.garage_jobs WHERE id = v_bay.current_job_id;
    SELECT vin INTO v_vin FROM public.cars WHERE id = v_job.car_id;

    UPDATE public.garage_jobs
       SET garage_bay_id = NULL,
           bay_exited_at = now(),
           status        = COALESCE(NULLIF(p_new_job_status,''), status),
           completed_at  = CASE
             WHEN COALESCE(NULLIF(p_new_job_status,''), status) IN ('done','delivered','cancelled')
                  THEN now()
             ELSE completed_at
           END,
           updated_at    = now()
     WHERE id = v_bay.current_job_id;

    INSERT INTO public.bay_assignment_history (
      bay_id, job_id, car_id, vin, event_type,
      bay_status_before, bay_status_after, created_by
    ) VALUES (
      p_bay_id, v_job.id, v_job.car_id, v_vin, 'exited',
      v_bay.status, p_set_bay_status, p_user_id
    );
  END IF;

  UPDATE public.garage_bays
     SET current_job_id = NULL,
         status         = p_set_bay_status,
         updated_at     = now()
   WHERE id = p_bay_id
   RETURNING * INTO v_bay;

  RETURN v_bay;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_bay(integer, uuid, text, text) TO authenticated;

-- 5. RPC: apply_part_to_job ----------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_part_to_job(
  p_job_id   uuid,
  p_part_id  uuid,
  p_quantity integer,
  p_note     text DEFAULT NULL,
  p_user_id  uuid DEFAULT auth.uid()
)
RETURNS public.job_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_part     public.parts;
  v_job_part public.job_parts;
  v_car_id   uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be > 0' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_part FROM public.parts WHERE id = p_part_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part % not found or deleted', p_part_id USING ERRCODE = '02000';
  END IF;
  IF v_part.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock (have %, need %)', v_part.quantity, p_quantity USING ERRCODE = '22023';
  END IF;

  SELECT car_id INTO v_car_id FROM public.garage_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id USING ERRCODE = '02000';
  END IF;

  UPDATE public.parts
     SET quantity   = quantity - p_quantity,
         updated_at = now()
   WHERE id = p_part_id;

  INSERT INTO public.part_movements (
    part_id, movement_type, quantity, car_id, job_description, note, created_by
  ) VALUES (
    p_part_id, 'stock_out', p_quantity, v_car_id,
    'Used on job ' || p_job_id::text, p_note, p_user_id
  );

  INSERT INTO public.job_parts (
    job_id, part_id, quantity, note, created_by,
    unit_cost_snapshot, currency_snapshot, used_at
  ) VALUES (
    p_job_id, p_part_id, p_quantity, p_note, p_user_id,
    v_part.unit_cost, v_part.currency, now()
  )
  RETURNING * INTO v_job_part;

  RETURN v_job_part;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_part_to_job(uuid, uuid, integer, text, uuid) TO authenticated;

-- 6. RPC: return_part_from_job -------------------------------------------

CREATE OR REPLACE FUNCTION public.return_part_from_job(
  p_job_part_id uuid,
  p_user_id     uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jp     public.job_parts;
  v_car_id uuid;
BEGIN
  SELECT * INTO v_jp FROM public.job_parts WHERE id = p_job_part_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_parts row % not found', p_job_part_id USING ERRCODE = '02000';
  END IF;

  SELECT car_id INTO v_car_id FROM public.garage_jobs WHERE id = v_jp.job_id;

  UPDATE public.parts
     SET quantity   = quantity + v_jp.quantity,
         updated_at = now()
   WHERE id = v_jp.part_id;

  INSERT INTO public.part_movements (
    part_id, movement_type, quantity, car_id, job_description, note, created_by
  ) VALUES (
    v_jp.part_id, 'return', v_jp.quantity, v_car_id,
    'Returned from job ' || v_jp.job_id::text, 'Reverted apply', p_user_id
  );

  DELETE FROM public.job_parts WHERE id = p_job_part_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.return_part_from_job(uuid, uuid) TO authenticated;

-- 7. Trigger: auto-recompute actual_hours --------------------------------

CREATE OR REPLACE FUNCTION public.recompute_job_actual_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  IF v_job_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.garage_jobs
     SET actual_hours = COALESCE((
       SELECT (SUM(duration_minutes)::numeric / 60.0)
         FROM public.job_time_entries
        WHERE job_id = v_job_id
          AND duration_minutes IS NOT NULL
     ), 0),
         updated_at = now()
   WHERE id = v_job_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_job_actual_hours ON public.job_time_entries;
CREATE TRIGGER trg_recompute_job_actual_hours
  AFTER INSERT OR UPDATE OR DELETE ON public.job_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_job_actual_hours();

-- 8. Views ----------------------------------------------------------------

DROP VIEW IF EXISTS public.garage_job_efficiency        CASCADE;
DROP VIEW IF EXISTS public.garage_bay_utilization       CASCADE;
DROP VIEW IF EXISTS public.garage_employee_efficiency   CASCADE;

CREATE VIEW public.garage_job_efficiency
WITH (security_invoker = on) AS
SELECT
  j.id                                                    AS job_id,
  j.job_number,
  j.car_id,
  c.vin, c.brand, c.model,
  j.status,
  j.estimated_hours,
  j.actual_hours,
  (COALESCE(j.actual_hours, 0) - COALESCE(j.estimated_hours, 0)::numeric) AS variance_hours,
  CASE
    WHEN j.estimated_hours IS NOT NULL AND j.estimated_hours > 0
      THEN COALESCE(j.actual_hours, 0) <= j.estimated_hours::numeric
    ELSE NULL
  END                                                     AS on_time,
  COALESCE(
    (SELECT SUM(jp.unit_cost_snapshot * jp.quantity)
       FROM public.job_parts jp
      WHERE jp.job_id = j.id),
    0
  )                                                       AS parts_cost_total,
  COALESCE(
    (SELECT MIN(jp.currency_snapshot)
       FROM public.job_parts jp
      WHERE jp.job_id = j.id),
    'USD'
  )                                                       AS parts_currency,
  j.started_at,
  j.completed_at,
  CASE
    WHEN j.started_at IS NOT NULL AND j.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) / 3600.0
    ELSE NULL
  END                                                     AS turnaround_hours,
  j.bay_entered_at,
  j.bay_exited_at,
  j.garage_bay_id,
  j.assigned_to
FROM public.garage_jobs j
LEFT JOIN public.cars c ON c.id = j.car_id
WHERE j.deleted_at IS NULL;

CREATE VIEW public.garage_bay_utilization
WITH (security_invoker = on) AS
WITH job_durations AS (
  SELECT
    garage_bay_id,
    SUM(EXTRACT(EPOCH FROM (COALESCE(bay_exited_at, now()) - bay_entered_at)) / 3600.0) AS hours_occupied,
    COUNT(*)                                                                            AS job_count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(bay_exited_at, now()) - bay_entered_at)) / 3600.0) AS avg_dwell_hours
  FROM public.garage_jobs
  WHERE bay_entered_at >= now() - interval '30 days'
    AND garage_bay_id IS NOT NULL
  GROUP BY garage_bay_id
)
SELECT
  b.id                                                   AS bay_id,
  b.bay_number,
  b.name,
  b.bay_type,
  b.status,
  b.current_job_id,
  COALESCE(jd.hours_occupied, 0)                         AS hours_occupied_30d,
  COALESCE(jd.job_count, 0)                              AS jobs_30d,
  jd.avg_dwell_hours,
  -- Naive utilisation: 30 days × 8 working hrs/day = 240 hrs.
  ROUND(((COALESCE(jd.hours_occupied, 0) / 240.0) * 100)::numeric, 1) AS utilization_pct
FROM public.garage_bays b
LEFT JOIN job_durations jd ON jd.garage_bay_id = b.id
WHERE b.is_active = true
ORDER BY b.sort_order, b.bay_number;

CREATE VIEW public.garage_employee_efficiency
WITH (security_invoker = on) AS
SELECT
  jte.employee_id,
  p.full_name                                            AS employee_name,
  p.user_role::text                                      AS role,
  COUNT(DISTINCT jte.job_id)                             AS jobs_count_30d,
  ROUND((SUM(jte.duration_minutes)::numeric / 60.0), 2)  AS total_hours_30d,
  ROUND((AVG(jte.duration_minutes)::numeric / 60.0), 2)  AS avg_hours_per_entry,
  ROUND(
    (AVG(
      CASE
        WHEN j.estimated_hours IS NOT NULL AND j.estimated_hours > 0 AND j.actual_hours IS NOT NULL
          THEN j.actual_hours::numeric / j.estimated_hours::numeric
        ELSE NULL
      END
    ))::numeric, 2)                                      AS avg_actual_vs_estimated_ratio
FROM public.job_time_entries jte
JOIN public.profiles p ON p.id = jte.employee_id
LEFT JOIN public.garage_jobs j ON j.id = jte.job_id
WHERE jte.started_at >= now() - interval '30 days'
  AND jte.duration_minutes IS NOT NULL
GROUP BY jte.employee_id, p.full_name, p.user_role;
