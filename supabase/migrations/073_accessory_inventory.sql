-- Replaces the localStorage-only accessories tracker on /accessories with a
-- proper Supabase-backed table. Sees all employees on all devices, no data
-- loss, RLS-gated for write.
--
-- Categories match the existing AccessoryCategory enum in the client:
--   plates, black_plates, cushion, charger, floor_matt

CREATE TABLE IF NOT EXISTS public.accessory_inventory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL CHECK (category IN ('plates','black_plates','cushion','charger','floor_matt')),
  label        text NOT NULL DEFAULT '',
  quantity     integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  note         text NOT NULL DEFAULT '',
  linked_plate text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_accessory_inventory_category
  ON public.accessory_inventory (category);
CREATE INDEX IF NOT EXISTS idx_accessory_inventory_created_by
  ON public.accessory_inventory (created_by);
CREATE INDEX IF NOT EXISTS idx_accessory_inventory_updated_by
  ON public.accessory_inventory (updated_by);

ALTER TABLE public.accessory_inventory ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated employee.
DROP POLICY IF EXISTS accessory_inventory_select ON public.accessory_inventory;
CREATE POLICY accessory_inventory_select ON public.accessory_inventory
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- Write (insert/update/delete): owners or `inventory` capability holders.
DROP POLICY IF EXISTS accessory_inventory_insert ON public.accessory_inventory;
CREATE POLICY accessory_inventory_insert ON public.accessory_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    is_owner() OR has_capability('inventory'::user_capability)
  );

DROP POLICY IF EXISTS accessory_inventory_update ON public.accessory_inventory;
CREATE POLICY accessory_inventory_update ON public.accessory_inventory
  FOR UPDATE TO authenticated
  USING (
    is_owner() OR has_capability('inventory'::user_capability)
  )
  WITH CHECK (
    is_owner() OR has_capability('inventory'::user_capability)
  );

DROP POLICY IF EXISTS accessory_inventory_delete ON public.accessory_inventory;
CREATE POLICY accessory_inventory_delete ON public.accessory_inventory
  FOR DELETE TO authenticated
  USING (
    is_owner() OR has_capability('inventory'::user_capability)
  );

-- Audit trigger: stamp updated_at + created_by/updated_by from auth.uid().
CREATE OR REPLACE FUNCTION public.tg_accessory_inventory_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_accessory_inventory_set_audit() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_accessory_inventory_audit ON public.accessory_inventory;
CREATE TRIGGER trg_accessory_inventory_audit
  BEFORE INSERT OR UPDATE ON public.accessory_inventory
  FOR EACH ROW EXECUTE FUNCTION public.tg_accessory_inventory_set_audit();
