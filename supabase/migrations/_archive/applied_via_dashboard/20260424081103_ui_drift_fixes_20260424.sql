-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424081103 as `ui_drift_fixes_20260424`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Fix every UI-breaking column drift uncovered by the code↔DB audit.

-- 1) requests.send_to / send_to_user_id — dropped earlier, but 6+ files still read/write them.
--    Table has 0 rows; safe to restore.
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS send_to         text;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS send_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) cars warranty columns that assistant-dashboard & cars/add read/write.
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS warranty_per_dms          date;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS warranty_expiry           date;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS warranty_monza_start_date date;

-- 3) payment_plans needs deleted_at for soft-delete patterns.
ALTER TABLE public.payment_plans ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 4) Rename cars.customs_paid_amount → customs_amount_paid and
--    cars.customs_paid_currency → customs_amount_currency to match code.
--    (customs-dialog.tsx writes the new names; TS types use them too.)
DROP VIEW IF EXISTS public.cars_missing_data CASCADE;
DROP VIEW IF EXISTS public.cars_display       CASCADE;
ALTER TABLE public.cars RENAME COLUMN customs_paid_amount    TO customs_amount_paid;
ALTER TABLE public.cars RENAME COLUMN customs_paid_currency  TO customs_amount_currency;

-- Recreate cars_display with the new names.
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
       c.date_arrived, c.location_changed_at, c.status_changed_at, c.price, c.price_currency,
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
       c.customs_amount_paid,
       c.customs_amount_currency,
       c.specs,
       COALESCE(cw.bl_issue_date, c.bl_issue_date)         AS bl_issue_date,
       COALESCE(cw.registration_date, c.registration_date) AS registration_date,
       c.deleted_at, c.notes, c.created_at, c.updated_at, c.created_by,
       concat_ws(' ', cust.first_name, cust.last_name) AS client_name,
       cust.phone_primary                              AS client_phone,
       ls.delivery_date, ls.reservation_date, ls.reserved_by,
       RIGHT(c.vin, 8)                                                       AS vin_short,
       (c.location_type::text || COALESCE((' - ' || c.location_slot), ''))   AS location_full,
       initcap(replace(c.status::text, '_', ' '))                            AS status_display,
       CASE WHEN c.battery_percent IS NOT NULL
            THEN (c.battery_percent || '%') ELSE '-' END                     AS battery_display,
       ls.date_bought
  FROM public.cars c
  LEFT JOIN latest_sales         ls ON ls.car_id = c.id
  LEFT JOIN public.customers    cust ON cust.id = c.customer_id
  LEFT JOIN public.car_warranties cw ON cw.car_id = c.id;

CREATE VIEW public.cars_missing_data
WITH (security_invoker = on) AS
SELECT c.id, c.vin, c.plate_number, c.brand, c.model, c.model_year,
       c.exterior_color, c.interior_color, c.status, c.location_type, c.location_slot,
       c.battery_percent, c.km_range, c.software_version, c.pdi_status, c.notes,
       c.created_at, c.updated_at, c.created_by, c.current_km, c.date_arrived,
       c.location_changed_at, c.status_changed_at, c.deleted_at, c.is_erev,
       c.ev_km, c.motor_km, c.customs_status, c.price, c.price_currency,
       c.customs_amount_paid, c.customs_amount_currency, c.sub_dealer_name,
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
