-- ============================================
-- MONZA TECH CRM - Add Price, Warranty, Customs
-- Migration 006: New columns on cars table
-- ============================================

-- ============================================
-- CUSTOMS STATUS ENUM
-- ============================================

CREATE TYPE customs_status AS ENUM (
  'pending',       -- Not yet cleared
  'in_progress',   -- Clearance in progress
  'cleared',       -- Fully cleared
  'exempt'         -- No customs needed
);

-- ============================================
-- NEW COLUMNS ON CARS TABLE
-- ============================================

-- Price (list / asking price for this car)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'USD';

-- Warranty expiry date
ALTER TABLE cars ADD COLUMN IF NOT EXISTS warranty_expiry DATE;

-- Customs clearance status
ALTER TABLE cars ADD COLUMN IF NOT EXISTS customs_status customs_status DEFAULT 'pending';

-- ============================================
-- CONSTRAINTS
-- ============================================

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_price_non_negative;
ALTER TABLE cars ADD CONSTRAINT cars_price_non_negative
  CHECK (price IS NULL OR price >= 0);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cars_customs_status ON cars(customs_status);

-- ============================================
-- UPDATE VIEWS (include new columns)
-- ============================================

-- cars_display
DROP VIEW IF EXISTS cars_display;
CREATE VIEW cars_display AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%' ELSE '-' END AS battery_display,
  CASE WHEN c.current_km IS NOT NULL THEN c.current_km || ' km' ELSE '-' END AS km_display,
  CASE WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived) ELSE NULL END AS days_in_inventory,
  -- Price display
  CASE
    WHEN c.price IS NOT NULL THEN TRIM(TO_CHAR(c.price, 'FM999,999,999.00')) || ' ' || COALESCE(c.price_currency, 'USD')
    ELSE '-'
  END AS price_display,
  -- Warranty remaining display
  CASE
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry > CURRENT_DATE
      THEN (c.warranty_expiry - CURRENT_DATE) || ' days'
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry <= CURRENT_DATE
      THEN 'Expired'
    ELSE '-'
  END AS warranty_display,
  -- Customs display
  CASE
    WHEN c.customs_status IS NOT NULL THEN INITCAP(REPLACE(c.customs_status::TEXT, '_', ' '))
    ELSE '-'
  END AS customs_display
FROM cars c
WHERE c.deleted_at IS NULL;

-- cars_with_sales
DROP VIEW IF EXISTS cars_with_sales;
CREATE VIEW cars_with_sales AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%' ELSE '-' END AS battery_display,
  CASE WHEN c.current_km IS NOT NULL THEN c.current_km || ' km' ELSE '-' END AS km_display,
  CASE WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived) ELSE NULL END AS days_in_inventory,
  CASE
    WHEN c.price IS NOT NULL THEN TRIM(TO_CHAR(c.price, 'FM999,999,999.00')) || ' ' || COALESCE(c.price_currency, 'USD')
    ELSE '-'
  END AS price_display,
  CASE
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry > CURRENT_DATE
      THEN (c.warranty_expiry - CURRENT_DATE) || ' days'
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry <= CURRENT_DATE
      THEN 'Expired'
    ELSE '-'
  END AS warranty_display,
  CASE
    WHEN c.customs_status IS NOT NULL THEN INITCAP(REPLACE(c.customs_status::TEXT, '_', ' '))
    ELSE '-'
  END AS customs_display,
  so.id AS sale_order_id,
  so.status AS sale_status,
  so.customer_id,
  so.selling_price,
  so.sale_date,
  so.delivery_date,
  so.reserved_until,
  so.deposit_amount,
  cust.first_name || ' ' || COALESCE(cust.last_name, '') AS customer_name,
  cust.phone_primary AS customer_phone
FROM cars c
LEFT JOIN LATERAL (
  SELECT * FROM sales_orders
  WHERE car_id = c.id AND status NOT IN ('cancelled')
  ORDER BY created_at DESC
  LIMIT 1
) so ON true
LEFT JOIN customers cust ON so.customer_id = cust.id
WHERE c.deleted_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN cars.price IS 'List / asking price for this car';
COMMENT ON COLUMN cars.price_currency IS 'Currency for the price (default USD)';
COMMENT ON COLUMN cars.warranty_expiry IS 'Warranty expiration date';
COMMENT ON COLUMN cars.customs_status IS 'Customs clearance status';
