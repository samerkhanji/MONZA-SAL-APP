-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420140428 as `final_cleanup_v3_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Recreate requests policies to drop references to dead columns first
DROP POLICY IF EXISTS "requests_update" ON public.requests;
DROP POLICY IF EXISTS "requests_select" ON public.requests;
DROP POLICY IF EXISTS "requests_insert" ON public.requests;

-- Minimal, correct policies using only canonical columns
CREATE POLICY "requests_select_all_auth" ON public.requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "requests_insert_own" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "requests_update_owner_or_party" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR reviewed_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR reviewed_by = auth.uid()
    OR public.is_any_role_resolved(ARRAY['owner']::public.user_role[])
  );

DROP VIEW IF EXISTS public.cars_missing_data CASCADE;

-- FK hardening
ALTER TABLE public.car_warranties DROP CONSTRAINT IF EXISTS car_warranties_car_id_fkey;
ALTER TABLE public.car_warranties ADD CONSTRAINT car_warranties_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;

ALTER TABLE public.car_accessories DROP CONSTRAINT IF EXISTS car_accessories_car_id_fkey;
ALTER TABLE public.car_accessories ADD CONSTRAINT car_accessories_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;

ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_car_id_fkey;
ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;

ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_customer_id_fkey;
ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_submitted_by_fkey;
ALTER TABLE public.requests ADD CONSTRAINT requests_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_assigned_to_fkey;
ALTER TABLE public.requests ADD CONSTRAINT requests_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_reviewed_by_fkey;
ALTER TABLE public.requests ADD CONSTRAINT requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.car_events DROP CONSTRAINT IF EXISTS car_events_created_by_fkey;
ALTER TABLE public.car_events ADD CONSTRAINT car_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop unused cars columns now that view is gone
ALTER TABLE public.cars DROP COLUMN IF EXISTS reserved_by_user_id;

-- Simplify requests table
ALTER TABLE public.requests DROP COLUMN IF EXISTS assigned_to_user_id;
ALTER TABLE public.requests DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE public.requests DROP COLUMN IF EXISTS recipient_user_id;
ALTER TABLE public.requests DROP COLUMN IF EXISTS send_to_user_id;
ALTER TABLE public.requests DROP COLUMN IF EXISTS send_to;
ALTER TABLE public.requests DROP COLUMN IF EXISTS recipient_role;

-- Drop shipping_eta_*
DROP TABLE IF EXISTS public.shipping_eta_events  CASCADE;
DROP TABLE IF EXISTS public.shipping_eta_entries CASCADE;

-- Migrate bl_issue_date + registration_date remnants
UPDATE public.car_warranties cw
   SET bl_issue_date     = COALESCE(cw.bl_issue_date, c.bl_issue_date),
       registration_date = COALESCE(cw.registration_date, c.registration_date)
  FROM public.cars c
 WHERE cw.car_id = c.id
   AND (c.bl_issue_date IS NOT NULL OR c.registration_date IS NOT NULL);

-- Recreate cars_missing_data without dropped columns
CREATE VIEW public.cars_missing_data
WITH (security_invoker = on) AS
SELECT c.id, c.vin, c.plate_number, c.brand, c.model, c.model_year,
       c.exterior_color, c.interior_color, c.status, c.location_type, c.location_slot,
       c.battery_percent, c.km_range, c.software_version, c.pdi_status, c.notes,
       c.created_at, c.updated_at, c.created_by, c.current_km, c.date_arrived,
       c.location_changed_at, c.status_changed_at, c.deleted_at, c.is_erev,
       c.ev_km, c.motor_km, c.customs_status, c.price, c.price_currency,
       c.customs_paid_amount, c.customs_paid_currency, c.sub_dealer_name,
       c.issue, c.software_update, c.dongle, c.sold_marker, c.suffix,
       c.engine_number, c.delivery_date, c.reservation_date, c.customer_id,
       c.sold_at, c.date_bought, c.specs,
       COALESCE(cw.bl_issue_date, c.bl_issue_date)         AS bl_issue_date,
       COALESCE(cw.registration_date, c.registration_date) AS registration_date,
       c."trim", c.customs_notes,
       cw.warranty_vehicle_dms, cw.warranty_battery_dms,
       cw.warranty_vehicle_km_limit, cw.warranty_battery_km_limit,
       cw.warranty_vehicle_expiry, cw.warranty_battery_expiry
  FROM public.cars c
  LEFT JOIN public.car_warranties cw ON cw.car_id = c.id
 WHERE c.deleted_at IS NULL
   AND (c.km_range IS NULL OR cw.warranty_vehicle_dms IS NULL
        OR c.customer_id IS NULL OR c.customs_status IS NULL);
