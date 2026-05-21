-- Migration 147: car arrival inspection checks.
--
-- When a shipped (inbound) car lands, staff run a receiving check before it
-- is accepted into the fleet: VIN matches the shipment, keys / documents /
-- charger / accessories present, exterior condition, and notes for anything
-- missing or damaged. One row per arrival inspection.
--
-- The "phase" of a car is derived, no new column needed:
--   * status = 'inbound'                                  -> In transit
--   * status = 'inventory' + has arrival check + pdi != done -> Awaiting PDI
--   * status = 'inventory' + pdi_status = 'done'           -> In fleet
--
-- Additive only — safe.

CREATE TABLE IF NOT EXISTS public.car_arrival_checks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id               uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  vin_confirmed        boolean NOT NULL DEFAULT false,
  keys_received        boolean NOT NULL DEFAULT false,
  documents_received   boolean NOT NULL DEFAULT false,
  charger_received     boolean NOT NULL DEFAULT false,
  accessories_received boolean NOT NULL DEFAULT false,
  exterior_ok          boolean NOT NULL DEFAULT false,
  has_issues           boolean NOT NULL DEFAULT false,
  damage_notes         text,
  missing_notes        text,
  checked_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_arrival_checks_car
  ON public.car_arrival_checks(car_id);

ALTER TABLE public.car_arrival_checks ENABLE ROW LEVEL SECURITY;

-- Any signed-in employee may view arrival checks (operational data, like
-- car_events). Recording one requires the inventory capability (or owner);
-- editing / deleting is owner-only.
DO $$ BEGIN
  CREATE POLICY car_arrival_checks_sel ON public.car_arrival_checks
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY car_arrival_checks_ins ON public.car_arrival_checks
    FOR INSERT TO authenticated
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY car_arrival_checks_upd ON public.car_arrival_checks
    FOR UPDATE TO authenticated
    USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY car_arrival_checks_del ON public.car_arrival_checks
    FOR DELETE TO authenticated
    USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.car_arrival_checks TO authenticated;
