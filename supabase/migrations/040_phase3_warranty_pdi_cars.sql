-- ============================================
-- MONZA CRM — Phase 3: warranty on delivery + column-level enforcement
--
-- RLS: this file does NOT add any policy on public.cars. The sole UPDATE policy
-- cars_update_restricted is patched via ALTER POLICY in 041 (assistant + khalil_hybrid).
-- 3.1: When status becomes delivered, fill Monza warranty from delivery_date (idempotent, no overwrite)
-- 3.2: Monza warranty columns — owner OR assistant with Lara/Samaya name match (same pattern as 014)
--      DMS warranty columns — owner OR khalil_hybrid
-- 3.3: pdi_status — owner OR assistant OR garage_manager
-- ============================================

-- Lara / Samaya: align with migration 014 bootstrap (full_name ILIKE)
CREATE OR REPLACE FUNCTION public.cars_phase3_can_edit_monza_warranty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
    OR (
      public.get_my_user_role_resolved() = 'assistant'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.full_name ILIKE '%Lara%' OR p.full_name ILIKE '%Samaya%')
      )
    );
$$;

COMMENT ON FUNCTION public.cars_phase3_can_edit_monza_warranty() IS
  'Phase 3.2: Monza warranty fields — owner or Lara/Samaya (assistant + name), for RLS/trigger checks.';

REVOKE ALL ON FUNCTION public.cars_phase3_can_edit_monza_warranty() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cars_phase3_can_edit_monza_warranty() TO authenticated;

-- BEFORE UPDATE: apply Monza warranty from delivery when first marked delivered (only NULL slots)
CREATE OR REPLACE FUNCTION public.cars_phase3_apply_warranty_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d date;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT so.delivery_date INTO d
  FROM public.sales_orders so
  WHERE so.car_id = NEW.id
    AND so.status IS DISTINCT FROM 'cancelled'
  ORDER BY so.created_at DESC NULLS LAST
  LIMIT 1;

  IF d IS NULL THEN
    d := NEW.delivery_date;
  END IF;
  IF d IS NULL THEN
    d := OLD.delivery_date;
  END IF;

  IF d IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.warranty_monza_start_date IS NULL THEN
    NEW.warranty_monza_start_date := d;
  END IF;
  IF OLD.warranty_vehicle_expiry IS NULL THEN
    NEW.warranty_vehicle_expiry := (d + interval '5 years')::date;
  END IF;
  IF OLD.warranty_battery_expiry IS NULL THEN
    NEW.warranty_battery_expiry := (d + interval '8 years')::date;
  END IF;
  IF OLD.warranty_expiry IS NULL AND NEW.warranty_vehicle_expiry IS NOT NULL THEN
    NEW.warranty_expiry := NEW.warranty_vehicle_expiry;
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE UPDATE: reject unauthorized changes to warranty / PDI columns
CREATE OR REPLACE FUNCTION public.cars_phase3_enforce_warranty_pdi_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d date;
  exp_v date;
  exp_b date;
  transitioning boolean;
  autofill_ok boolean;
BEGIN
  IF public.is_any_role_resolved(ARRAY['owner']::public.user_role[]) THEN
    RETURN NEW;
  END IF;

  IF OLD.pdi_status IS DISTINCT FROM NEW.pdi_status THEN
    IF NOT public.is_any_role_resolved(
      ARRAY['assistant', 'garage_manager']::public.user_role[]
    ) THEN
      RAISE EXCEPTION 'permission denied: pdi_status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.warranty_per_dms IS DISTINCT FROM NEW.warranty_per_dms
     OR OLD.warranty_battery_dms IS DISTINCT FROM NEW.warranty_battery_dms THEN
    IF NOT public.is_any_role_resolved(
      ARRAY['owner', 'khalil_hybrid']::public.user_role[]
    ) THEN
      RAISE EXCEPTION 'permission denied: warranty DMS fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.warranty_monza_start_date IS DISTINCT FROM NEW.warranty_monza_start_date
     OR OLD.warranty_vehicle_expiry IS DISTINCT FROM NEW.warranty_vehicle_expiry
     OR OLD.warranty_battery_expiry IS DISTINCT FROM NEW.warranty_battery_expiry
     OR OLD.warranty_expiry IS DISTINCT FROM NEW.warranty_expiry
     OR OLD.warranty_vehicle_km_limit IS DISTINCT FROM NEW.warranty_vehicle_km_limit
     OR OLD.warranty_battery_km_limit IS DISTINCT FROM NEW.warranty_battery_km_limit THEN

    IF public.cars_phase3_can_edit_monza_warranty() THEN
      NULL;
    ELSE
      transitioning := OLD.status IS DISTINCT FROM 'delivered' AND NEW.status = 'delivered';

      SELECT so.delivery_date INTO d
      FROM public.sales_orders so
      WHERE so.car_id = NEW.id
        AND so.status IS DISTINCT FROM 'cancelled'
      ORDER BY so.created_at DESC NULLS LAST
      LIMIT 1;

      IF d IS NULL THEN
        d := NEW.delivery_date;
      END IF;
      IF d IS NULL THEN
        d := OLD.delivery_date;
      END IF;

      exp_v := (d + interval '5 years')::date;
      exp_b := (d + interval '8 years')::date;

      autofill_ok := transitioning
        AND d IS NOT NULL
        AND (
          NOT (OLD.warranty_monza_start_date IS DISTINCT FROM NEW.warranty_monza_start_date)
          OR (OLD.warranty_monza_start_date IS NULL AND NEW.warranty_monza_start_date IS NOT DISTINCT FROM d)
        )
        AND (
          NOT (OLD.warranty_vehicle_expiry IS DISTINCT FROM NEW.warranty_vehicle_expiry)
          OR (OLD.warranty_vehicle_expiry IS NULL AND NEW.warranty_vehicle_expiry IS NOT DISTINCT FROM exp_v)
        )
        AND (
          NOT (OLD.warranty_battery_expiry IS DISTINCT FROM NEW.warranty_battery_expiry)
          OR (OLD.warranty_battery_expiry IS NULL AND NEW.warranty_battery_expiry IS NOT DISTINCT FROM exp_b)
        )
        AND (
          NOT (OLD.warranty_expiry IS DISTINCT FROM NEW.warranty_expiry)
          OR (
            OLD.warranty_expiry IS NULL
            AND (
              NEW.warranty_expiry IS NOT DISTINCT FROM NEW.warranty_vehicle_expiry
              OR NEW.warranty_expiry IS NOT DISTINCT FROM exp_v
            )
          )
        );

      IF NOT autofill_ok THEN
        RAISE EXCEPTION 'permission denied: Monza warranty fields'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cars_phase3_apply_warranty_on_delivered ON public.cars;
CREATE TRIGGER cars_phase3_apply_warranty_on_delivered
  BEFORE UPDATE ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.cars_phase3_apply_warranty_on_delivered();

DROP TRIGGER IF EXISTS cars_phase3_enforce_warranty_pdi_changes ON public.cars;
CREATE TRIGGER cars_phase3_enforce_warranty_pdi_changes
  BEFORE UPDATE ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.cars_phase3_enforce_warranty_pdi_changes();

COMMENT ON FUNCTION public.cars_phase3_apply_warranty_on_delivered() IS
  'Phase 3.1: on first transition to delivered, set Monza warranty from delivery_date (+5y vehicle, +8y battery) where still NULL.';
COMMENT ON FUNCTION public.cars_phase3_enforce_warranty_pdi_changes() IS
  'Phase 3.2–3.3: column-level UPDATE rules for warranty + PDI on public.cars.';
