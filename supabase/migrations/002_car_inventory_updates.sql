-- ============================================
-- MONZA TECH CRM - Car Inventory Updates
-- Migration 002: Add missing fields + linked tables
-- ============================================

-- ============================================
-- UPDATE CARS TABLE (add missing fields)
-- ============================================

-- Add current_km (odometer reading)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_km INTEGER;

-- Add date_arrived (when car arrived at facility)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS date_arrived DATE;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_cars_date_arrived ON cars(date_arrived DESC);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN last_name IS NOT NULL THEN first_name || ' ' || last_name
      ELSE first_name
    END
  ) STORED,
  
  -- Contact
  phone_primary TEXT NOT NULL,
  phone_secondary TEXT,
  email TEXT,
  
  -- Preferences
  preferred_language TEXT DEFAULT 'en',  -- en, ar, etc.
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone_primary);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_full_name ON customers(full_name);

-- Updated_at trigger
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all customers"
  ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SALES_ORDERS TABLE (car sales / deals)
-- ============================================

-- Sale status enum
CREATE TYPE sale_status AS ENUM (
  'draft',        -- Quote/draft
  'confirmed',    -- Sale confirmed
  'paid',         -- Payment received
  'delivered',    -- Car delivered to customer
  'cancelled'     -- Sale cancelled
);

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  car_id UUID NOT NULL REFERENCES cars(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Sale details
  status sale_status NOT NULL DEFAULT 'draft',
  selling_price DECIMAL(12, 2),
  currency TEXT DEFAULT 'AED',
  
  -- Dates
  sale_date DATE,              -- When sale was confirmed
  delivery_date DATE,          -- When car was delivered
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_sales_orders_car_id ON sales_orders(car_id);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_sale_date ON sales_orders(sale_date DESC);

-- Updated_at trigger
CREATE TRIGGER sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all sales_orders"
  ON sales_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sales_orders"
  ON sales_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales_orders"
  ON sales_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- RESERVATIONS TABLE
-- ============================================

-- Reservation status enum
CREATE TYPE reservation_status AS ENUM (
  'active',       -- Currently reserved
  'converted',    -- Converted to sale
  'expired',      -- Reservation expired
  'cancelled'     -- Cancelled by customer/staff
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  car_id UUID NOT NULL REFERENCES cars(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Reservation details
  status reservation_status NOT NULL DEFAULT 'active',
  reserved_until DATE,          -- Expiry date
  deposit_amount DECIMAL(12, 2),
  
  -- Notes
  notes TEXT,
  
  -- Converted to sale?
  converted_to_sale_id UUID REFERENCES sales_orders(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_reservations_car_id ON reservations(car_id);
CREATE INDEX idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX idx_reservations_status ON reservations(status);

-- Updated_at trigger
CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all reservations"
  ON reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert reservations"
  ON reservations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update reservations"
  ON reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- PDI_REPORTS TABLE (Pre-Delivery Inspection)
-- ============================================

CREATE TABLE pdi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to car
  car_id UUID NOT NULL REFERENCES cars(id),
  
  -- Inspection details (store as JSON for flexibility)
  -- This allows different checklist items without schema changes
  checklist JSONB DEFAULT '{}',
  
  -- Summary
  notes TEXT,
  issues_found TEXT,
  
  -- Sign-off
  inspector_name TEXT,
  inspected_at TIMESTAMPTZ,
  
  -- Status tracking
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_pdi_reports_car_id ON pdi_reports(car_id);
CREATE INDEX idx_pdi_reports_is_complete ON pdi_reports(is_complete);

-- Updated_at trigger
CREATE TRIGGER pdi_reports_updated_at
  BEFORE UPDATE ON pdi_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE pdi_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all pdi_reports"
  ON pdi_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pdi_reports"
  ON pdi_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pdi_reports"
  ON pdi_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED CARS_DISPLAY VIEW
-- ============================================

-- Drop and recreate with new fields
DROP VIEW IF EXISTS cars_display;

CREATE VIEW cars_display AS
SELECT
  c.*,
  -- Shortened VIN (last 8 chars)
  RIGHT(c.vin, 8) AS vin_short,
  -- Full location string
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  -- Display status
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
  END AS days_in_inventory
FROM cars c;

-- ============================================
-- HELPER VIEW: Cars with linked data
-- ============================================

CREATE VIEW cars_with_links AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  
  -- Latest reservation (if any)
  r.id AS active_reservation_id,
  r.customer_id AS reserved_by_customer_id,
  r.reserved_until,
  
  -- Customer name (if reserved)
  res_cust.full_name AS reserved_by_name,
  res_cust.phone_primary AS reserved_by_phone,
  
  -- Latest sale (if sold)
  s.id AS sale_id,
  s.customer_id AS sold_to_customer_id,
  s.selling_price,
  s.sale_date,
  s.delivery_date,
  
  -- Customer name (if sold)
  sale_cust.full_name AS sold_to_name,
  sale_cust.phone_primary AS sold_to_phone,
  
  -- Latest PDI report
  pdi.id AS latest_pdi_id,
  pdi.is_complete AS pdi_complete,
  pdi.inspected_at AS pdi_inspected_at

FROM cars c

-- Active reservation
LEFT JOIN LATERAL (
  SELECT * FROM reservations 
  WHERE car_id = c.id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1
) r ON true

LEFT JOIN customers res_cust ON r.customer_id = res_cust.id

-- Latest sale (delivered or confirmed)
LEFT JOIN LATERAL (
  SELECT * FROM sales_orders 
  WHERE car_id = c.id AND status IN ('confirmed', 'paid', 'delivered')
  ORDER BY created_at DESC LIMIT 1
) s ON true

LEFT JOIN customers sale_cust ON s.customer_id = sale_cust.id

-- Latest PDI report
LEFT JOIN LATERAL (
  SELECT * FROM pdi_reports 
  WHERE car_id = c.id
  ORDER BY created_at DESC LIMIT 1
) pdi ON true;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE customers IS 'Customer/client records - linked to sales, reservations, leads';
COMMENT ON TABLE sales_orders IS 'Car sales records - links car to customer with price, dates';
COMMENT ON TABLE reservations IS 'Car reservations - temporary hold before sale';
COMMENT ON TABLE pdi_reports IS 'Pre-Delivery Inspection reports - checklist and sign-off';

COMMENT ON COLUMN cars.current_km IS 'Current odometer reading in kilometers';
COMMENT ON COLUMN cars.date_arrived IS 'Date the car arrived at the facility';
COMMENT ON COLUMN pdi_reports.checklist IS 'JSON object storing checklist items and their status';
