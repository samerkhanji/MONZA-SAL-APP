-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260420135243 as `cleanup_dead_tables_columns_v3_20260420`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Must DROP views first since CREATE OR REPLACE cannot remove columns.
DROP VIEW IF EXISTS public.cars_missing_data                         CASCADE;
DROP VIEW IF EXISTS public.data_health_placeholder_phones            CASCADE;
DROP VIEW IF EXISTS public.data_health_sold_car_without_sales_order  CASCADE;

-- Drop the snapshot columns (now unreferenced)
ALTER TABLE public.cars DROP COLUMN IF EXISTS customer_name_snapshot;
ALTER TABLE public.cars DROP COLUMN IF EXISTS customer_phone_snapshot;
ALTER TABLE public.cars DROP COLUMN IF EXISTS reserved_by_name_snapshot;

-- Recreate views without snapshot refs
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
       COALESCE(cw.bl_issue_date, c.bl_issue_date)          AS bl_issue_date,
       COALESCE(cw.registration_date, c.registration_date)  AS registration_date,
       c.reserved_by_user_id, c."trim", c.customs_notes,
       cw.warranty_vehicle_dms, cw.warranty_battery_dms,
       cw.warranty_vehicle_km_limit, cw.warranty_battery_km_limit,
       cw.warranty_vehicle_expiry, cw.warranty_battery_expiry
  FROM public.cars c
  LEFT JOIN public.car_warranties cw ON cw.car_id = c.id
 WHERE c.deleted_at IS NULL
   AND (c.km_range IS NULL OR cw.warranty_vehicle_dms IS NULL
        OR c.customer_id IS NULL OR c.customs_status IS NULL);

CREATE VIEW public.data_health_placeholder_phones
WITH (security_invoker = on) AS
SELECT customers.id, customers.first_name, customers.last_name,
       customers.phone_primary, 'customers'::text AS source_table
  FROM public.customers
 WHERE customers.deleted_at IS NULL
   AND customers.phone_primary IS NOT NULL
   AND TRIM(BOTH FROM customers.phone_primary) <> ''
   AND (customers.phone_primary ~ '^0+$'
        OR customers.phone_primary ~ '^0[0-9]{0,5}$');

CREATE VIEW public.data_health_sold_car_without_sales_order
WITH (security_invoker = on) AS
SELECT c.id, c.vin, c.brand, c.model, c.model_year, c.status,
       TRIM(cust.first_name || ' ' || COALESCE(cust.last_name,'')) AS legacy_client_name,
       cust.phone_primary                                           AS legacy_client_phone
  FROM public.cars c
  LEFT JOIN public.sales_orders so  ON so.car_id = c.id AND so.status <> 'cancelled'::sale_status
  LEFT JOIN public.customers    cust ON cust.id   = c.customer_id
 WHERE c.status = ANY (ARRAY['sold'::car_status,'delivered'::car_status,'reserved'::car_status])
   AND c.deleted_at IS NULL
   AND so.id IS NULL;

-- Drop 5 dead tables
DROP TABLE IF EXISTS public.installment_history      CASCADE;
DROP TABLE IF EXISTS public.installments             CASCADE;
DROP TABLE IF EXISTS public.calendar_events          CASCADE;
DROP TABLE IF EXISTS public.client_contact_log       CASCADE;
DROP TABLE IF EXISTS public.client_payment_followups CASCADE;
