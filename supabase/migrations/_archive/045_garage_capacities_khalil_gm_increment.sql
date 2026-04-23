-- Garage capacities: battery_lab default 2; khalil_hybrid may UPDATE; garage_manager +1-only on listed resources (enforced in DB).

UPDATE public.garage_capacities
SET capacity = 2
WHERE resource_name = 'battery_lab';

DROP POLICY IF EXISTS garage_capacities_update_mgmt ON public.garage_capacities;

CREATE POLICY garage_capacities_update_mgmt
  ON public.garage_capacities FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner', 'garage_manager', 'khalil_hybrid']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'garage_manager', 'khalil_hybrid']::public.user_role[]
    )
  );

CREATE OR REPLACE FUNCTION public.garage_capacities_enforce_gm_increment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  gm_increment text[] := ARRAY[
    'bays',
    'pit',
    'oven',
    'car_painting',
    'ev_bays',
    'body_work',
    'battery_lab',
    'polish'
  ];
BEGIN
  IF public.get_my_user_role_resolved() = 'garage_manager'::public.user_role THEN
    IF NEW.resource_name = 'car_wash' THEN
      RAISE EXCEPTION 'garage_manager cannot update car_wash capacity';
    END IF;
    IF NEW.resource_name = ANY (gm_increment) THEN
      IF NEW.capacity IS DISTINCT FROM OLD.capacity + 1 THEN
        RAISE EXCEPTION 'garage_manager may only increase capacity by 1';
      END IF;
    ELSE
      RAISE EXCEPTION 'garage_manager cannot update this resource capacity';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garage_capacities_enforce_gm_increment ON public.garage_capacities;
CREATE TRIGGER garage_capacities_enforce_gm_increment
  BEFORE UPDATE ON public.garage_capacities
  FOR EACH ROW
  EXECUTE FUNCTION public.garage_capacities_enforce_gm_increment();
