-- ============================================
-- MONZA CRM — Employee-defined accessory collections
-- Migration 035
--
-- Prerequisite: 027_rls_helper_functions.sql
-- App: /accessories — "Custom collections" section
--
-- Rules:
-- - Employees (same roles as accessory_inventory) can CREATE collections and CRUD rows.
-- - Collection definitions (name) cannot be UPDATED or DELETED by non-owners (RLS).
-- ============================================

CREATE TABLE IF NOT EXISTS public.accessory_custom_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accessory_custom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.accessory_custom_tables (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  note text,
  linked_plate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accessory_custom_items_table_id
  ON public.accessory_custom_items (table_id, created_at);

CREATE INDEX IF NOT EXISTS idx_accessory_custom_tables_created_at
  ON public.accessory_custom_tables (created_at DESC);

-- ---------- accessory_custom_tables RLS ----------

ALTER TABLE public.accessory_custom_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accessory_custom_tables_select_authenticated" ON public.accessory_custom_tables;
CREATE POLICY "accessory_custom_tables_select_authenticated"
  ON public.accessory_custom_tables
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "accessory_custom_tables_insert_roles_self" ON public.accessory_custom_tables;
CREATE POLICY "accessory_custom_tables_insert_roles_self"
  ON public.accessory_custom_tables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

-- Only owner may rename or remove a collection definition
DROP POLICY IF EXISTS "accessory_custom_tables_update_owner" ON public.accessory_custom_tables;
CREATE POLICY "accessory_custom_tables_update_owner"
  ON public.accessory_custom_tables
  FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  )
  WITH CHECK (
    public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

DROP POLICY IF EXISTS "accessory_custom_tables_delete_owner" ON public.accessory_custom_tables;
CREATE POLICY "accessory_custom_tables_delete_owner"
  ON public.accessory_custom_tables
  FOR DELETE
  TO authenticated
  USING (
    public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

-- ---------- accessory_custom_items RLS ----------

ALTER TABLE public.accessory_custom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accessory_custom_items_select_authenticated" ON public.accessory_custom_items;
CREATE POLICY "accessory_custom_items_select_authenticated"
  ON public.accessory_custom_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "accessory_custom_items_write_roles" ON public.accessory_custom_items;
CREATE POLICY "accessory_custom_items_write_roles"
  ON public.accessory_custom_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "accessory_custom_items_update_roles" ON public.accessory_custom_items;
CREATE POLICY "accessory_custom_items_update_roles"
  ON public.accessory_custom_items
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

DROP POLICY IF EXISTS "accessory_custom_items_delete_roles" ON public.accessory_custom_items;
CREATE POLICY "accessory_custom_items_delete_roles"
  ON public.accessory_custom_items
  FOR DELETE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner', 'assistant', 'khalil_hybrid', 'it', 'sales_ops']::public.user_role[]
    )
  );

COMMENT ON TABLE public.accessory_custom_tables IS 'User-defined accessory groupings; employees create; only owner may update/delete definition.';
COMMENT ON TABLE public.accessory_custom_items IS 'Line items inside accessory_custom_tables; employees may CRUD.';
