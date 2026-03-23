-- ============================================
-- MONZA CRM — accessory_inventory (vehicle accessories)
-- Migration 033
--
-- App route: /accessories (localStorage until wired to Supabase).
-- Category values must match web/src/types/accessories.ts AccessoryCategory.
-- ============================================

CREATE TABLE IF NOT EXISTS public.accessory_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (
    category IN (
      'plates',
      'black_plates',
      'cushion',
      'charger',
      'floor_matt'
    )
  ),
  label text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  note text,
  linked_plate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accessory_inventory_category_created
  ON public.accessory_inventory (category, created_at, label);

ALTER TABLE public.accessory_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accessory_inventory_select_authenticated" ON public.accessory_inventory;
CREATE POLICY "accessory_inventory_select_authenticated"
  ON public.accessory_inventory
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "accessory_inventory_insert_roles" ON public.accessory_inventory;
CREATE POLICY "accessory_inventory_insert_roles"
  ON public.accessory_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "accessory_inventory_update_roles" ON public.accessory_inventory;
CREATE POLICY "accessory_inventory_update_roles"
  ON public.accessory_inventory
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "accessory_inventory_delete_owner" ON public.accessory_inventory;
CREATE POLICY "accessory_inventory_delete_owner"
  ON public.accessory_inventory
  FOR DELETE
  TO authenticated
  USING (
    public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

COMMENT ON TABLE public.accessory_inventory IS 'Vehicle accessories stock (plates, mats, chargers, etc.); UI at /accessories.';
