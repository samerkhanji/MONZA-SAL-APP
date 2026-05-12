-- Close the workflow loop:
--   New garage_jobs row for a car  → flip cars.location_type to 'garage'
--   All live jobs for a car closed  → flip cars.location_type back to 'storage'
--
-- This complements migration 089 (which auto-creates a stub job when a
-- car arrives at the garage). With both triggers in place, the car ↔ job
-- relationship stays in sync regardless of which side the user updates.
--
-- Safe against feedback loop: the cars trigger from 089 short-circuits
-- when a live job already exists, so a flip from this trigger won't
-- re-create another stub.

CREATE OR REPLACE FUNCTION public.garage_jobs_sync_car_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_car_id   uuid;
  v_has_live boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_car_id := NEW.car_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_car_id := NEW.car_id;
    IF NEW.car_id IS NULL AND OLD.car_id IS NOT NULL THEN
      v_car_id := OLD.car_id;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_car_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.garage_jobs
     WHERE car_id = v_car_id
       AND deleted_at IS NULL
       AND status NOT IN ('done','cancelled','delivered')
  ) INTO v_has_live;

  IF v_has_live THEN
    UPDATE public.cars
       SET location_type = 'garage'::location_type,
           updated_at    = now()
     WHERE id = v_car_id
       AND location_type IS DISTINCT FROM 'garage'::location_type
       AND deleted_at IS NULL;
  ELSE
    UPDATE public.cars
       SET location_type = 'storage'::location_type,
           updated_at    = now()
     WHERE id = v_car_id
       AND location_type = 'garage'::location_type
       AND deleted_at IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_garage_jobs_sync_car_location ON public.garage_jobs;
CREATE TRIGGER trg_garage_jobs_sync_car_location
  AFTER INSERT OR UPDATE OF status, deleted_at, car_id
  ON public.garage_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.garage_jobs_sync_car_location();
