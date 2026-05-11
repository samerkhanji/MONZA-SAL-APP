-- Owner-reported gap: cars arriving at the garage have no auto-created
-- job card, so the Assign-to-Bay dialog says "no unassigned jobs" even
-- when cars are visibly at the garage.
--
-- Bonus root-cause find: the existing CHECK constraint on garage_jobs.status
-- ('open', 'in_progress', 'waiting_parts', 'ready', 'delivered', 'cancelled')
-- never agreed with the FE, which uses 'pending' and 'done' throughout.
-- That means every "New Job" click from the UI would have failed at the DB
-- level — we widen the constraint to accept what the UI actually writes
-- while keeping the legacy values for backward compatibility.

ALTER TABLE public.garage_jobs DROP CONSTRAINT IF EXISTS garage_jobs_job_status_check;
ALTER TABLE public.garage_jobs ADD CONSTRAINT garage_jobs_job_status_check
  CHECK (status IN (
    'pending',
    'open',
    'in_progress',
    'waiting_parts',
    'ready',
    'done',
    'delivered',
    'cancelled'
  ));

ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS task_category_id text
    REFERENCES public.task_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_garage_jobs_task_category
  ON public.garage_jobs(task_category_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cars_auto_create_garage_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_has_live_job boolean;
  v_label        text;
BEGIN
  IF NEW.location_type IS DISTINCT FROM 'garage' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.location_type IS NOT DISTINCT FROM 'garage' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.garage_jobs
     WHERE car_id = NEW.id
       AND deleted_at IS NULL
       AND status NOT IN ('done','cancelled','delivered')
  ) INTO v_has_live_job;

  IF v_has_live_job THEN
    RETURN NEW;
  END IF;

  v_label := 'Service intake — '
    || coalesce(NEW.brand,'')
    || CASE WHEN NEW.model IS NOT NULL THEN ' ' || NEW.model ELSE '' END
    || ' · '
    || right(coalesce(NEW.vin,''), 8);

  INSERT INTO public.garage_jobs (
    car_id, status, priority, title, description, work_checklist,
    is_battery_only, created_by
  ) VALUES (
    NEW.id, 'pending', 'medium',
    trim(both ' ·-' from v_label),
    'Auto-created on garage arrival. Open intake to pick category.',
    '[]'::jsonb, false, NULL
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cars_auto_create_garage_job ON public.cars;
CREATE TRIGGER trg_cars_auto_create_garage_job
  AFTER INSERT OR UPDATE OF location_type ON public.cars
  FOR EACH ROW
  WHEN (NEW.location_type = 'garage')
  EXECUTE FUNCTION public.cars_auto_create_garage_job();

INSERT INTO public.garage_jobs (
  car_id, status, priority, title, description, work_checklist,
  is_battery_only, created_by
)
SELECT
  c.id, 'pending', 'medium',
  trim(both ' ·-' from (
    'Service intake — '
    || coalesce(c.brand,'')
    || CASE WHEN c.model IS NOT NULL THEN ' ' || c.model ELSE '' END
    || ' · '
    || right(coalesce(c.vin,''), 8)
  )),
  'Auto-created on garage arrival. Open intake to pick category.',
  '[]'::jsonb, false, NULL
FROM public.cars c
WHERE c.location_type = 'garage'
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.garage_jobs gj
     WHERE gj.car_id = c.id
       AND gj.deleted_at IS NULL
       AND gj.status NOT IN ('done','cancelled','delivered')
  );
