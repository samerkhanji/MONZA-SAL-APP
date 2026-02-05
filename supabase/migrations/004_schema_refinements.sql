-- ============================================
-- MONZA TECH CRM - Schema Refinements
-- Migration 004: Constraints, indexes, sync, soft-delete
-- ============================================

-- ============================================
-- CARS: plate_number (nullable, unique when not null)
-- ============================================

-- Drop existing unique constraint on plate_number (if exists)
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_plate_number_key;

-- Partial unique index: unique only when plate_number is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_plate_number_unique
  ON cars(plate_number) WHERE plate_number IS NOT NULL;

-- ============================================
-- CARS: location_changed_at, status_changed_at
-- ============================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS location_changed_at TIMESTAMPTZ;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- ============================================
-- CARS: deleted_at (soft-delete)
-- ============================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cars_deleted_at ON cars(deleted_at);
-- Typical query: WHERE deleted_at IS NULL for "active" cars

-- ============================================
-- CARS: Data constraints
-- ============================================

-- current_km >= 0
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_current_km_non_negative;
ALTER TABLE cars ADD CONSTRAINT cars_current_km_non_negative
  CHECK (current_km IS NULL OR current_km >= 0);

-- model_year reasonable range (e.g. 1900 - 2100)
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_model_year_range;
ALTER TABLE cars ADD CONSTRAINT cars_model_year_range
  CHECK (model_year IS NULL OR (model_year >= 1900 AND model_year <= 2100));

-- battery_percent 0-100 already in 001; ensure it exists
-- (no-op if already there)

-- ============================================
-- CARS: Indexes (ensure all exist)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_location_type ON cars(location_type);
CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);
CREATE INDEX IF NOT EXISTS idx_cars_model ON cars(model);

-- ============================================
-- CAR_EVENTS: meta jsonb
-- ============================================

ALTER TABLE car_events ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

COMMENT ON COLUMN car_events.meta IS 'Structured details for the event (e.g. extra payload)';

-- ============================================
-- CAR_EVENTS: Composite index (car_id, created_at desc)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_car_events_car_id_created_at
  ON car_events(car_id, created_at DESC);

-- ============================================
-- CUSTOMERS: Remove full_name, keep first_name + last_name
-- ============================================

-- Drop views that depend on customers.full_name FIRST
DROP VIEW IF EXISTS cars_with_sales;
DROP VIEW IF EXISTS cars_display;

-- Drop index that may exist on full_name
DROP INDEX IF EXISTS idx_customers_full_name;

-- Drop generated column full_name (PostgreSQL: drop column)
ALTER TABLE customers DROP COLUMN IF EXISTS full_name;

-- ============================================
-- CUSTOMERS: phone_primary UNIQUE
-- ============================================

-- Drop any existing constraint or index on phone_primary
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_primary_key;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_primary_unique;
DROP INDEX IF EXISTS idx_customers_phone;
DROP INDEX IF EXISTS customers_phone_primary_unique;

-- Use unique index (idempotent: IF NOT EXISTS = no "already exists" error)
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_primary_unique ON customers(phone_primary);

-- ============================================
-- SALES_ORDERS: reserved_until, deposit_amount
-- ============================================

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS reserved_until DATE;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12, 2);

COMMENT ON COLUMN sales_orders.reserved_until IS 'For reservations: expiry date';
COMMENT ON COLUMN sales_orders.deposit_amount IS 'Deposit paid (optional)';
COMMENT ON COLUMN sales_orders.currency IS 'e.g. AED, USD, LBP';

-- ============================================
-- SALES_ORDERS: Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_orders_car_id ON sales_orders(car_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);

-- ============================================
-- CARS: Auto-set location_changed_at, status_changed_at
-- ============================================

CREATE OR REPLACE FUNCTION cars_set_changed_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.location_type IS DISTINCT FROM NEW.location_type OR OLD.location_slot IS DISTINCT FROM NEW.location_slot THEN
    NEW.location_changed_at := NOW();
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cars_set_changed_timestamps ON cars;
CREATE TRIGGER trg_cars_set_changed_timestamps
  BEFORE UPDATE ON cars
  FOR EACH ROW
  EXECUTE FUNCTION cars_set_changed_timestamps();

-- ============================================
-- SYNC: sales_orders.status <-> cars.status
-- ============================================

CREATE OR REPLACE FUNCTION sync_car_status_from_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE cars
    SET status = CASE NEW.status
      WHEN 'reserved' THEN 'reserved'::car_status
      WHEN 'confirmed' THEN 'sold'::car_status
      WHEN 'paid' THEN 'sold'::car_status
      WHEN 'delivered' THEN 'delivered'::car_status
      WHEN 'cancelled' THEN 'in_stock'::car_status
      WHEN 'draft' THEN cars.status
      ELSE cars.status
    END
    WHERE id = NEW.car_id;
    -- status_changed_at is set by trg_cars_set_changed_timestamps on cars
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_car_status_from_sale ON sales_orders;
CREATE TRIGGER trg_sync_car_status_from_sale
  AFTER INSERT OR UPDATE OF status ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_car_status_from_sale();

-- ============================================
-- VIEW: customers with computed full_name
-- ============================================

CREATE OR REPLACE VIEW customers_display AS
SELECT
  c.*,
  TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')) AS full_name
FROM customers c;

-- ============================================
-- CARS_DISPLAY: Exclude soft-deleted, add timestamps
-- ============================================

DROP VIEW IF EXISTS cars_display;
CREATE VIEW cars_display AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%' ELSE '-' END AS battery_display,
  CASE WHEN c.current_km IS NOT NULL THEN c.current_km || ' km' ELSE '-' END AS km_display,
  CASE WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived) ELSE NULL END AS days_in_inventory
FROM cars c
WHERE c.deleted_at IS NULL;

-- ============================================
-- CARS_WITH_SALES: Exclude soft-deleted
-- ============================================

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

COMMENT ON COLUMN cars.plate_number IS 'Nullable; unique only when not null';
COMMENT ON COLUMN cars.location_changed_at IS 'Last time location was changed';
COMMENT ON COLUMN cars.status_changed_at IS 'Last time status was changed';
COMMENT ON COLUMN cars.deleted_at IS 'Soft-delete: set to NOW() to hide, NULL = active';
