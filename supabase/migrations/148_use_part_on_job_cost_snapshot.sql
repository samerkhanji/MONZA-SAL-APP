-- Migration 148: snapshot part cost in use_part_on_job.
--
-- use_part_on_job (migration 125) inserts job_parts WITHOUT the cost
-- snapshot columns (unit_cost_snapshot, currency_snapshot, used_at) that
-- apply_part_to_job records. Parts attached when a job is CREATED via
-- NewJobDialog therefore carry no frozen cost, so the job's parts-cost
-- total and the efficiency report change retroactively if the part's
-- unit_cost is later edited. This re-creates use_part_on_job identical to
-- migration 125 except the job_parts INSERT now snapshots the cost, exactly
-- like apply_part_to_job. CREATE OR REPLACE — safe and idempotent.

CREATE OR REPLACE FUNCTION public.use_part_on_job(
  p_job_id uuid,
  p_part_id uuid,
  p_quantity integer,
  p_note text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_car_id   uuid;
  v_part     public.parts;
  v_title    text;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be > 0' USING errcode = '22023';
  END IF;

  -- Load and lock the part row first; mirror apply_part_to_job's stock check.
  SELECT * INTO v_part FROM public.parts WHERE id = p_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part % not found', p_part_id USING errcode = '02000';
  END IF;
  IF v_part.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % requested, % available',
      p_quantity, v_part.quantity
      USING errcode = '22023';
  END IF;

  -- Resolve job + car
  SELECT car_id, title INTO v_car_id, v_title
    FROM public.garage_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id USING errcode = '02000';
  END IF;

  -- Stock out via shared helper (records part_movements)
  PERFORM public.move_part_stock(
    p_part_id,
    'stock_out',
    p_quantity,
    v_car_id,
    v_title,
    p_note,
    p_user_id
  );

  -- Link part to job WITH a frozen cost snapshot (matches apply_part_to_job),
  -- so the job's parts cost does not drift if the part's price changes later.
  INSERT INTO public.job_parts (
    job_id, part_id, quantity, note, created_by,
    unit_cost_snapshot, currency_snapshot, used_at
  )
  VALUES (
    p_job_id, p_part_id, p_quantity, p_note, p_user_id,
    v_part.unit_cost, v_part.currency, now()
  );
END;
$function$;
