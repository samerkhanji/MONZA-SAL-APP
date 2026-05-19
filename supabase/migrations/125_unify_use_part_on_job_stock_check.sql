-- 125_unify_use_part_on_job_stock_check.sql
-- Bring use_part_on_job in line with apply_part_to_job:
-- - FOR UPDATE row lock on parts
-- - Insufficient-stock guard (RAISE with errcode 22023) BEFORE delegating to
--   move_part_stock, so the user gets a clear, consistent error message.

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

  -- Link part to job
  INSERT INTO public.job_parts (job_id, part_id, quantity, note, created_by)
  VALUES (p_job_id, p_part_id, p_quantity, p_note, p_user_id);
END;
$function$;
