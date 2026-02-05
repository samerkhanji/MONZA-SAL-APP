-- ============================================
-- MONZA TECH CRM - Car Inventory Schema
-- Migration 001: Core car inventory tables
-- ============================================

-- ============================================
-- ENUMS (strict values, no random data)
-- ============================================

-- Car lifecycle status
CREATE TYPE car_status AS ENUM (
  'inbound',      -- Car ordered/in transit
  'in_stock',     -- At facility, not yet on showroom
  'showroom',     -- On display floor
  'reserved',     -- Reserved for a customer/deal
  'sold',         -- Sale completed
  'delivered',    -- Handed over to customer
  'service'       -- In garage for service/repair
);

-- Physical location type
CREATE TYPE location_type AS ENUM (
  'showroom1',    -- Showroom 1
  'showroom2',    -- Showroom 2
  'garage',       -- Service garage
  'storage'       -- Storage/warehouse
);

-- PDI (Pre-Delivery Inspection) status
CREATE TYPE pdi_status AS ENUM (
  'pending',      -- Not started
  'in_progress',  -- Being done
  'done'          -- Completed
);

-- Event types for car history
CREATE TYPE car_event_type AS ENUM (
  'created',          -- Car record created
  'moved',            -- Location changed
  'status_changed',   -- Status changed
  'battery_updated',  -- Battery % updated
  'pdi_updated',      -- PDI status changed
  'details_updated',  -- Other details changed
  'note_added'        -- Note/comment added
);

-- ============================================
-- CARS TABLE (current state only)
-- ============================================

CREATE TABLE cars (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin TEXT UNIQUE NOT NULL,
  plate_number TEXT UNIQUE,
  
  -- Vehicle info
  brand TEXT NOT NULL,                    -- Voyah / MHero / other
  model TEXT NOT NULL,
  model_year INTEGER,
  
  -- Colors / trim
  exterior_color TEXT,
  interior_color TEXT,
  
  -- Status (lifecycle position)
  status car_status NOT NULL DEFAULT 'inbound',
  
  -- Location (physical position)
  location_type location_type NOT NULL DEFAULT 'storage',
  location_slot TEXT,                     -- e.g., "S1-R3-C12", "Garage-Bay2"
  
  -- EV / Technical specs
  battery_percent INTEGER CHECK (battery_percent >= 0 AND battery_percent <= 100),
  ev_range_km INTEGER,
  motor TEXT,
  software_version TEXT,
  
  -- PDI / Readiness
  pdi_status pdi_status NOT NULL DEFAULT 'pending',
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- CAR_EVENTS TABLE (history / audit trail)
-- ============================================

CREATE TABLE car_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  
  -- What happened
  event_type car_event_type NOT NULL,
  
  -- Change details
  from_value TEXT,                        -- Previous value (if applicable)
  to_value TEXT,                          -- New value (if applicable)
  
  -- Additional context
  note TEXT,
  
  -- Who and when
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES (for fast queries)
-- ============================================

-- Cars table indexes
CREATE INDEX idx_cars_vin ON cars(vin);
CREATE INDEX idx_cars_status ON cars(status);
CREATE INDEX idx_cars_location_type ON cars(location_type);
CREATE INDEX idx_cars_brand_model ON cars(brand, model);
CREATE INDEX idx_cars_created_at ON cars(created_at DESC);

-- Car events indexes
CREATE INDEX idx_car_events_car_id ON car_events(car_id);
CREATE INDEX idx_car_events_event_type ON car_events(event_type);
CREATE INDEX idx_car_events_created_at ON car_events(created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cars_updated_at
  BEFORE UPDATE ON cars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_events ENABLE ROW LEVEL SECURITY;

-- Cars policies (internal system - all authenticated users can access)
CREATE POLICY "Authenticated users can view all cars"
  ON cars FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cars"
  ON cars FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cars"
  ON cars FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Car events policies
CREATE POLICY "Authenticated users can view all car events"
  ON car_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert car events"
  ON car_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to move a car (atomic: update + event log)
CREATE OR REPLACE FUNCTION move_car(
  p_car_id UUID,
  p_new_location_type location_type,
  p_new_location_slot TEXT,
  p_new_status car_status DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS cars AS $$
DECLARE
  v_car cars;
  v_old_location TEXT;
  v_new_location TEXT;
BEGIN
  -- Get current car state
  SELECT * INTO v_car FROM cars WHERE id = p_car_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Car not found: %', p_car_id;
  END IF;
  
  -- Build location strings for event log
  v_old_location := v_car.location_type::TEXT || ':' || COALESCE(v_car.location_slot, '');
  v_new_location := p_new_location_type::TEXT || ':' || COALESCE(p_new_location_slot, '');
  
  -- Update car location
  UPDATE cars SET
    location_type = p_new_location_type,
    location_slot = p_new_location_slot,
    status = COALESCE(p_new_status, status)
  WHERE id = p_car_id
  RETURNING * INTO v_car;
  
  -- Log the move event
  INSERT INTO car_events (car_id, event_type, from_value, to_value, note, created_by)
  VALUES (p_car_id, 'moved', v_old_location, v_new_location, p_note, p_user_id);
  
  -- Log status change if applicable
  IF p_new_status IS NOT NULL AND p_new_status != v_car.status THEN
    INSERT INTO car_events (car_id, event_type, from_value, to_value, note, created_by)
    VALUES (p_car_id, 'status_changed', v_car.status::TEXT, p_new_status::TEXT, p_note, p_user_id);
  END IF;
  
  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a car (with automatic event log)
CREATE OR REPLACE FUNCTION create_car(
  p_vin TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_model_year INTEGER DEFAULT NULL,
  p_exterior_color TEXT DEFAULT NULL,
  p_interior_color TEXT DEFAULT NULL,
  p_location_type location_type DEFAULT 'storage',
  p_location_slot TEXT DEFAULT NULL,
  p_status car_status DEFAULT 'inbound',
  p_user_id UUID DEFAULT NULL
)
RETURNS cars AS $$
DECLARE
  v_car cars;
BEGIN
  -- Insert the car
  INSERT INTO cars (
    vin, brand, model, model_year,
    exterior_color, interior_color,
    location_type, location_slot, status,
    created_by
  ) VALUES (
    p_vin, p_brand, p_model, p_model_year,
    p_exterior_color, p_interior_color,
    p_location_type, p_location_slot, p_status,
    p_user_id
  )
  RETURNING * INTO v_car;
  
  -- Log creation event
  INSERT INTO car_events (car_id, event_type, to_value, note, created_by)
  VALUES (v_car.id, 'created', 'VIN: ' || p_vin, 'Car added to inventory', p_user_id);
  
  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS (for easier querying)
-- ============================================

-- Cars with formatted display info
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
  END AS battery_display
FROM cars c;

-- ============================================
-- COMMENTS (documentation)
-- ============================================

COMMENT ON TABLE cars IS 'Main car inventory table - one record per physical vehicle (identified by VIN)';
COMMENT ON TABLE car_events IS 'Audit trail for all car changes (location, status, etc.)';

COMMENT ON COLUMN cars.vin IS 'Vehicle Identification Number - unique identifier';
COMMENT ON COLUMN cars.location_type IS 'Physical location category';
COMMENT ON COLUMN cars.location_slot IS 'Specific slot/position within location (e.g., S1-R3-C12)';
COMMENT ON COLUMN cars.status IS 'Current lifecycle status';
COMMENT ON COLUMN cars.pdi_status IS 'Pre-Delivery Inspection status';

COMMENT ON FUNCTION move_car IS 'Atomic function to move a car - updates location AND logs event in one transaction';
COMMENT ON FUNCTION create_car IS 'Creates a new car record with automatic event logging';
