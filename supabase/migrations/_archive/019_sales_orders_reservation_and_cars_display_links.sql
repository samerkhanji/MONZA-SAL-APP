-- ============================================
-- MONZA CRM - Relational customer linkage
-- Migration 019: sales_orders reservation fields
-- and cars_display view using relational data
-- ============================================

-- 1) Add reservation metadata to sales_orders (if not present)
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS reservation_date DATE;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS reserved_by TEXT;

-- 2) Rebuild cars_display view to prefer relational data
--    while keeping legacy fallback from cars.*
CREATE OR REPLACE VIEW public.cars_display AS
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
    so.created_at
  FROM public.sales_orders so
  WHERE so.status <> 'cancelled'
  ORDER BY so.car_id, so.created_at DESC
)
SELECT
  -- Base car columns
  c.*,

  -- Relationally resolved customer fields with legacy fallback
  COALESCE(
    NULLIF(TRIM(CONCAT(cust.first_name, ' ', COALESCE(cust.last_name, ''))), ''),
    c.client_name
  ) AS client_name,
  COALESCE(cust.phone_primary, c.client_phone) AS client_phone,
  COALESCE(ls.delivery_date, c.delivery_date) AS delivery_date,
  COALESCE(ls.reservation_date, c.reservation_date) AS reservation_date,
  COALESCE(ls.reserved_by, c.reserved_by) AS reserved_by,

  -- Existing computed helper fields
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE
    WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%'
    ELSE '-'
  END AS battery_display
FROM public.cars c
LEFT JOIN latest_sales ls
  ON ls.car_id = c.id
LEFT JOIN public.customers cust
  ON cust.id = ls.customer_id;

