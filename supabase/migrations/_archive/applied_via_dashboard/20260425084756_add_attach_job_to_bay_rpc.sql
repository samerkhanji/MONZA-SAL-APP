-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260425084756 as `add_attach_job_to_bay_rpc`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Sister of scan_vin_to_bay: attach an EXISTING job to a bay atomically
-- (used by the "pick existing job" UI path).
CREATE OR REPLACE FUNCTION public.attach_job_to_bay(
  p_job_id  uuid,
  p_bay_id  integer,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS public.garage_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.garage_jobs;
  v_bay public.garage_bays;
  v_vin text;
BEGIN
  SELECT * INTO v_bay FROM public.garage_bays WHERE id = p_bay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bay % not found', p_bay_id USING ERRCODE = '02000';
  END IF;
  IF v_bay.is_active = false THEN
    RAISE EXCEPTION 'Bay % is inactive', p_bay_id USING ERRCODE = '23P01';
  END IF;
  IF v_bay.current_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bay % already occupied by job %',
      p_bay_id, v_bay.current_job_id USING ERRCODE = '23P01';
  END IF;

  SELECT * INTO v_job FROM public.garage_jobs
   WHERE id = p_job_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id USING ERRCODE = '02000';
  END IF;
  IF v_job.garage_bay_id IS NOT NULL AND v_job.garage_bay_id <> p_bay_id THEN
    RAISE EXCEPTION 'Job % is already on bay %',
      p_job_id, v_job.garage_bay_id USING ERRCODE = '23P01';
  END IF;

  -- Battery-only enforcement matches the dialog's pre-filter
  IF v_bay.bay_type = 'battery_lab' AND COALESCE(v_job.is_battery_only, false) = false THEN
    RAISE EXCEPTION 'Battery Lab bays accept battery-only jobs' USING ERRCODE = '23P01';
  END IF;
  IF v_bay.bay_type <> 'battery_lab' AND COALESCE(v_job.is_battery_only, false) = true THEN
    RAISE EXCEPTION 'Battery-only jobs go to a Battery Lab bay' USING ERRCODE = '23P01';
  END IF;

  UPDATE public.garage_jobs
     SET garage_bay_id  = p_bay_id,
         bay_entered_at = now(),
         status         = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
         started_at     = COALESCE(started_at, now()),
         assigned_to    = COALESCE(assigned_to, p_user_id),
         updated_at     = now()
   WHERE id = p_job_id
   RETURNING * INTO v_job;

  UPDATE public.garage_bays
     SET current_job_id = v_job.id,
         status         = 'occupied',
         updated_at     = now()
   WHERE id = p_bay_id;

  SELECT vin INTO v_vin FROM public.cars WHERE id = v_job.car_id;
  INSERT INTO public.bay_assignment_history (
    bay_id, job_id, car_id, vin, event_type,
    bay_status_before, bay_status_after, created_by
  ) VALUES (
    p_bay_id, v_job.id, v_job.car_id, v_vin, 'entered',
    v_bay.status, 'occupied', p_user_id
  );

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_job_to_bay(uuid, integer, uuid) TO authenticated;
