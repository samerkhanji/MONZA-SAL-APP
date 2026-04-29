-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260423133017 as `rule_consolidation_v2_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- A. MFA enforcement (RESTRICTIVE so it can't be OR-bypassed)
DROP POLICY IF EXISTS "Require MFA to view cars"        ON public.cars;
DROP POLICY IF EXISTS "Require MFA for all"             ON public.profiles;
DROP POLICY IF EXISTS "Require MFA for profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Require MFA for updates"         ON public.profiles;

CREATE POLICY "cars_require_mfa" ON public.cars AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "profiles_require_mfa_write" ON public.profiles AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'aal') = 'aal2')
  WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');

-- B. Drop broken RPC functions
DROP FUNCTION IF EXISTS public.create_task_from_calendar_event(uuid, uuid);
DROP FUNCTION IF EXISTS public.log_shipping_eta_events() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_department_id()    CASCADE;

-- C. Consolidate updated_at trigger functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS customers_updated_at            ON public.customers;
CREATE TRIGGER customers_updated_at            BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS sales_orders_updated_at         ON public.sales_orders;
CREATE TRIGGER sales_orders_updated_at         BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS garage_tasks_set_updated_at     ON public.garage_tasks;
CREATE TRIGGER garage_tasks_set_updated_at     BEFORE UPDATE ON public.garage_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS acc_custom_items_touch          ON public.accessory_custom_items;
CREATE TRIGGER acc_custom_items_touch          BEFORE UPDATE ON public.accessory_custom_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS acc_custom_tables_touch         ON public.accessory_custom_tables;
CREATE TRIGGER acc_custom_tables_touch         BEFORE UPDATE ON public.accessory_custom_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS gjbc_touch                      ON public.garage_job_bay_context;
CREATE TRIGGER gjbc_touch                      BEFORE UPDATE ON public.garage_job_bay_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP FUNCTION IF EXISTS public.update_updated_at()           CASCADE;
DROP FUNCTION IF EXISTS public.touch_updated_at()            CASCADE;
DROP FUNCTION IF EXISTS public.tg_touch_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS public.profiles_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS public.garage_tasks_set_updated_at() CASCADE;

-- D. Drop sales_orders.reserved_by_user_id (recreate cars_display view without it)
DROP VIEW IF EXISTS public.cars_display CASCADE;

ALTER TABLE public.sales_orders DROP COLUMN IF EXISTS reserved_by_user_id;

CREATE VIEW public.cars_display
WITH (security_invoker = on) AS
WITH latest_sales AS (
  SELECT DISTINCT ON (so.car_id) so.car_id, so.id, so.customer_id, so.status,
         so.selling_price, so.currency, so.sale_date, so.delivery_date,
         so.reservation_date, so.reserved_by, so.date_bought, so.created_at
    FROM public.sales_orders so
   WHERE so.status <> 'cancelled'::sale_status
   ORDER BY so.car_id, so.created_at DESC
)
SELECT c.id, c.vin, c.plate_number, c.sub_dealer_name, c.brand, c.model, c.model_year,
       c.exterior_color, c.interior_color, c.status, c.issue, c.software_update, c.dongle,
       c.sold_marker, c.suffix, c."trim", c.engine_number, c.customer_id,
       c.location_type, c.location_slot, c.location_floor, c.battery_percent, c.km_range,
       c.is_erev, c.ev_km, c.motor_km, c.software_version, c.pdi_status, c.current_km,
       c.date_arrived, c.location_changed_at, c.status_changed_at,
       c.price, c.price_currency,
       cw.warranty_vehicle_dms, cw.warranty_battery_dms,
       cw.warranty_vehicle_km_limit, cw.warranty_battery_km_limit,
       cw.warranty_vehicle_expiry, cw.warranty_battery_expiry,
       (cw.warranty_vehicle_dms IS NOT NULL AND cw.warranty_vehicle_dms < CURRENT_DATE) AS warranty_vehicle_expired,
       (cw.warranty_battery_dms IS NOT NULL AND cw.warranty_battery_dms < CURRENT_DATE) AS warranty_battery_expired,
       CASE WHEN cw.warranty_vehicle_dms IS NULL THEN 'unknown'
            WHEN cw.warranty_vehicle_dms < CURRENT_DATE THEN 'expired'
            ELSE 'active' END AS warranty_vehicle_status,
       CASE WHEN cw.warranty_battery_dms IS NULL THEN 'unknown'
            WHEN cw.warranty_battery_dms < CURRENT_DATE THEN 'expired'
            ELSE 'active' END AS warranty_battery_status,
       c.customs_status, c.customs_notes,
       c.customs_paid_amount   AS customs_amount_paid,
       c.customs_paid_currency AS customs_amount_currency,
       c.specs,
       COALESCE(cw.bl_issue_date, c.bl_issue_date)         AS bl_issue_date,
       COALESCE(cw.registration_date, c.registration_date) AS registration_date,
       c.deleted_at, c.notes, c.created_at, c.updated_at, c.created_by,
       concat_ws(' ', cust.first_name, cust.last_name) AS client_name,
       cust.phone_primary                              AS client_phone,
       ls.delivery_date, ls.reservation_date, ls.reserved_by,
       RIGHT(c.vin, 8)                                         AS vin_short,
       (c.location_type::text || COALESCE((' - ' || c.location_slot), '')) AS location_full,
       initcap(replace(c.status::text, '_', ' '))              AS status_display,
       CASE WHEN c.battery_percent IS NOT NULL
            THEN (c.battery_percent || '%') ELSE '-' END       AS battery_display,
       ls.date_bought
  FROM public.cars c
  LEFT JOIN latest_sales ls         ON ls.car_id = c.id
  LEFT JOIN public.customers cust   ON cust.id = c.customer_id
  LEFT JOIN public.car_warranties cw ON cw.car_id = c.id;

-- E. Missing FK indexes
CREATE INDEX IF NOT EXISTS idx_garage_jobs_assigned_to        ON public.garage_jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_garage_jobs_opened_by          ON public.garage_jobs(opened_by);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_car_id            ON public.garage_tasks(car_id);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_assigned_to       ON public.garage_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_created_by        ON public.garage_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_template_item_id  ON public.garage_tasks(template_item_id);
CREATE INDEX IF NOT EXISTS idx_garage_task_template_items_tid ON public.garage_task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_garage_task_templates_created_by ON public.garage_task_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_garage_capacities_updated_by   ON public.garage_capacities(updated_by);
CREATE INDEX IF NOT EXISTS idx_acc_custom_items_created_by    ON public.accessory_custom_items(created_by);
CREATE INDEX IF NOT EXISTS idx_acc_custom_tables_created_by   ON public.accessory_custom_tables(created_by);
CREATE INDEX IF NOT EXISTS idx_gjbc_created_by                ON public.garage_job_bay_context(created_by);
CREATE INDEX IF NOT EXISTS idx_icg_updated_by                 ON public.infrastructure_compute_target(updated_by);
CREATE INDEX IF NOT EXISTS idx_page_access_reviewed_by        ON public.page_access_requests(reviewed_by);

-- F. Harden search_path on remaining DEFINER functions
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef = true
  LOOP
    BEGIN EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
