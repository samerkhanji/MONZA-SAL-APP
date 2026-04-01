-- ============================================
-- MONZA CRM — cars_display: explicit columns + date_bought (safe recreate)
--
-- Postgres rejects CREATE OR REPLACE VIEW when the new definition’s output
-- columns differ in name, type, or position from the existing view.
--
-- Strategy: drop dependents first, drop cars_display, then CREATE both views.
-- cars_with_sales lists every output column explicitly from cars_display (no SELECT *).
-- date_bought is the last column on both views (after display helpers).
--
-- Explicit c.<column> list (no c.*): omit legacy client_name, client_phone,
-- reservation_date, delivery_date, reserved_by from the bare list; emit each
-- once via COALESCE(sales_orders/customers, cars). date_bought from sales_orders
-- only (ls.date_bought). Use c.model_year (not c.year).
-- ============================================

DROP VIEW IF EXISTS public.cars_with_sales;
DROP VIEW IF EXISTS public.cars_display;

CREATE VIEW public.cars_display AS
WITH latest_sales AS (
  SELECT DISTINCT ON (so.car_id)
    so.car_id,
    so.id,
    so.customer_id,
    so.status,
    so.selling_price,
    so.currency,
    so.sale_date,
    so.delivery_date,
    so.reservation_date,
    so.reserved_by,
    so.date_bought,
    so.created_at
  FROM public.sales_orders so
  WHERE so.status <> 'cancelled'
  ORDER BY so.car_id, so.created_at DESC
)
SELECT
  c.id,
  c.vin,
  c.plate_number,
  c.sub_dealer_name,
  c.brand,
  c.model,
  c.model_year, -- not c.year — column is model_year on public.cars
  c.exterior_color,
  c.interior_color,
  c.status,
  c.issue,
  c.software_update,
  c.dongle,
  c.sold_marker,
  c.suffix,
  c.engine_number,
  c.customer_id,
  c.location_type,
  c.location_slot,
  c.location_floor,
  c.battery_percent,
  c.ev_range_km,
  c.motor,
  c.is_erev,
  c.ev_km,
  c.motor_km,
  c.software_version,
  c.pdi_status,
  c.current_km,
  c.date_arrived,
  c.location_changed_at,
  c.status_changed_at,
  c.price,
  c.price_currency,
  c.warranty_expiry,
  c.warranty_vehicle_expiry,
  c.warranty_battery_expiry,
  c.warranty_per_dms,
  c.warranty_monza_start_date,
  c.warranty_battery_dms,
  c.warranty_vehicle_km_limit,
  c.warranty_battery_km_limit,
  c.customs_status,
  c.customs_amount_paid,
  c.customs_amount_currency,
  c.deleted_at,
  c.notes,
  c.created_at,
  c.updated_at,
  c.created_by,

  COALESCE(
    NULLIF(TRIM(CONCAT(cust.first_name, ' ', COALESCE(cust.last_name, ''))), ''),
    c.client_name
  ) AS client_name,
  COALESCE(cust.phone_primary, c.client_phone) AS client_phone,
  COALESCE(ls.delivery_date, c.delivery_date) AS delivery_date,
  COALESCE(ls.reservation_date, c.reservation_date) AS reservation_date,
  COALESCE(ls.reserved_by, c.reserved_by) AS reserved_by,

  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE
    WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%'
    ELSE '-'
  END AS battery_display,

  ls.date_bought AS date_bought
FROM public.cars c
LEFT JOIN latest_sales ls
  ON ls.car_id = c.id
LEFT JOIN public.customers cust
  ON cust.id = ls.customer_id;

-- Read model: explicit columns only, same order as cars_display; date_bought last.
CREATE VIEW public.cars_with_sales AS
SELECT
  cd.id,
  cd.vin,
  cd.plate_number,
  cd.sub_dealer_name,
  cd.brand,
  cd.model,
  cd.model_year,
  cd.exterior_color,
  cd.interior_color,
  cd.status,
  cd.issue,
  cd.software_update,
  cd.dongle,
  cd.sold_marker,
  cd.suffix,
  cd.engine_number,
  cd.customer_id,
  cd.location_type,
  cd.location_slot,
  cd.location_floor,
  cd.battery_percent,
  cd.ev_range_km,
  cd.motor,
  cd.is_erev,
  cd.ev_km,
  cd.motor_km,
  cd.software_version,
  cd.pdi_status,
  cd.current_km,
  cd.date_arrived,
  cd.location_changed_at,
  cd.status_changed_at,
  cd.price,
  cd.price_currency,
  cd.warranty_expiry,
  cd.warranty_vehicle_expiry,
  cd.warranty_battery_expiry,
  cd.warranty_per_dms,
  cd.warranty_monza_start_date,
  cd.warranty_battery_dms,
  cd.warranty_vehicle_km_limit,
  cd.warranty_battery_km_limit,
  cd.customs_status,
  cd.customs_amount_paid,
  cd.customs_amount_currency,
  cd.deleted_at,
  cd.notes,
  cd.created_at,
  cd.updated_at,
  cd.created_by,
  cd.client_name,
  cd.client_phone,
  cd.delivery_date,
  cd.reservation_date,
  cd.reserved_by,
  cd.vin_short,
  cd.location_full,
  cd.status_display,
  cd.battery_display,
  cd.date_bought
FROM public.cars_display cd;

COMMENT ON VIEW public.cars_with_sales IS
  'Read model: cars + latest sales_orders (excludes cancelled). Use public.sales_orders for writes.';

GRANT SELECT ON public.cars_with_sales TO authenticated;
