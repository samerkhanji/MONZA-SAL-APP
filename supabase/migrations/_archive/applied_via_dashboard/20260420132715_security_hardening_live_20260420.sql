-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420132715 as `security_hardening_live_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Live security hardening matched to actual DB state.

ALTER TABLE public.car_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_warranties  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "car_accessories_select" ON public.car_accessories;
CREATE POLICY "car_accessories_select" ON public.car_accessories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "car_warranties_select" ON public.car_warranties;
CREATE POLICY "car_warranties_select" ON public.car_warranties
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "car_accessories_write" ON public.car_accessories;
CREATE POLICY "car_accessories_write" ON public.car_accessories
  FOR ALL TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops','garage_manager','khalil_hybrid']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops','garage_manager','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "car_warranties_write" ON public.car_warranties;
CREATE POLICY "car_warranties_write" ON public.car_warranties
  FOR ALL TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','khalil_hybrid']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','khalil_hybrid']::public.user_role[]
    )
  );

DROP POLICY IF EXISTS "sales_orders_select_authenticated" ON public.sales_orders;
CREATE POLICY "sales_orders_select_sales_roles"
  ON public.sales_orders FOR SELECT TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

ALTER VIEW public.cars_display                 SET (security_invoker = on);
ALTER VIEW public.accessory_inventory_display  SET (security_invoker = on);
ALTER VIEW public.cars_missing_data            SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.user_role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF caller_role = 'owner' THEN
    RETURN NEW;
  END IF;

  IF (NEW.user_role IS DISTINCT FROM OLD.user_role)
     OR (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
     OR (NEW.employment_status IS DISTINCT FROM OLD.employment_status)
     OR (NEW.capabilities IS DISTINCT FROM OLD.capabilities)
     OR (NEW.capabilities_jsonb IS DISTINCT FROM OLD.capabilities_jsonb)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (NEW.can_view_owner_requests IS DISTINCT FROM OLD.can_view_owner_requests)
     OR (NEW.is_pipeline_user IS DISTINCT FROM OLD.is_pipeline_user)
     OR (NEW.department_id IS DISTINCT FROM OLD.department_id)
  THEN
    RAISE EXCEPTION 'Not authorized to change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER profiles_block_self_privilege_escalation_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();

-- Dynamically harden mutable-search_path functions (unknown signatures).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_updated_at','resolve_actor_id','log_shipping_eta_events')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
