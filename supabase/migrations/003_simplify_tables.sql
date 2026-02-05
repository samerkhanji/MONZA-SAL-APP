-- ============================================
-- MONZA TECH CRM - Simplify to 4 Tables
-- Migration 003: Remove reservations & pdi_reports
-- ============================================

-- ============================================
-- DROP VIEWS THAT REFERENCE TABLES WE'RE REMOVING
-- ============================================

DROP VIEW IF EXISTS cars_with_links;

-- ============================================
-- DROP TABLES
-- ============================================

DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS pdi_reports;

-- ============================================
-- DROP UNUSED ENUMS
-- ============================================

DROP TYPE IF EXISTS reservation_status;

-- ============================================
-- UPDATE SALE_STATUS ENUM (add 'reserved')
-- ============================================

-- In PostgreSQL, we need to add new value to enum
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'reserved' BEFORE 'draft';

-- ============================================
-- FINAL 4 TABLES STRUCTURE
-- ============================================

-- 1. cars - Car inventory (already exists, no changes needed)
-- 2. car_events - History/audit trail (already exists)
-- 3. customers - Client records (already exists)
-- 4. sales_orders - Sales + reservations combined (updated enum)

-- ============================================
-- UPDATED VIEW: cars_with_sales
-- ============================================

CREATE VIEW cars_with_sales AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  
  -- Battery display
  CASE 
    WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%'
    ELSE '-'
  END AS battery_display,
  
  -- KM display
  CASE 
    WHEN c.current_km IS NOT NULL THEN c.current_km || ' km'
    ELSE '-'
  END AS km_display,
  
  -- Days in inventory
  CASE 
    WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived)
    ELSE NULL
  END AS days_in_inventory,
  
  -- Latest sale/reservation info
  so.id AS sale_order_id,
  so.status AS sale_status,
  so.customer_id,
  so.selling_price,
  so.sale_date,
  so.delivery_date,
  
  -- Customer info (if linked via sale)
  cust.full_name AS customer_name,
  cust.phone_primary AS customer_phone

FROM cars c

-- Latest active sale/reservation
LEFT JOIN LATERAL (
  SELECT * FROM sales_orders 
  WHERE car_id = c.id 
    AND status NOT IN ('cancelled')
  ORDER BY created_at DESC 
  LIMIT 1
) so ON true

LEFT JOIN customers cust ON so.customer_id = cust.id;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON VIEW cars_with_sales IS 'Cars joined with latest sale/reservation and customer info';
