-- ============================================
-- MONZA TECH CRM - Add location floor/section + inventory
-- Migration 010
-- ============================================
-- Track which floor or section (e.g. Floor 1, Floor 2) in garage/storage
-- Add 'inventory' as location type to distinguish from garage

ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'inventory';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS location_floor TEXT;

COMMENT ON COLUMN cars.location_floor IS 'Floor or section within location (e.g. Floor 1, Floor 2, Section A)';

-- Update move_car to accept and set location_floor
CREATE OR REPLACE FUNCTION move_car(
  p_car_id UUID,
  p_new_location_type location_type,
  p_new_location_slot TEXT,
  p_new_location_floor TEXT DEFAULT NULL,
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
  SELECT * INTO v_car FROM cars WHERE id = p_car_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Car not found: %', p_car_id;
  END IF;

  v_old_location := v_car.location_type::TEXT || ':' || COALESCE(v_car.location_floor, '') || ':' || COALESCE(v_car.location_slot, '');
  v_new_location := p_new_location_type::TEXT || ':' || COALESCE(p_new_location_floor, '') || ':' || COALESCE(p_new_location_slot, '');

  UPDATE cars SET
    location_type = p_new_location_type,
    location_slot = p_new_location_slot,
    location_floor = p_new_location_floor,
    status = COALESCE(p_new_status, status)
  WHERE id = p_car_id
  RETURNING * INTO v_car;

  INSERT INTO car_events (car_id, event_type, from_value, to_value, note, created_by)
  VALUES (p_car_id, 'moved', v_old_location, v_new_location, p_note, p_user_id);

  IF p_new_status IS NOT NULL AND p_new_status != v_car.status THEN
    INSERT INTO car_events (car_id, event_type, from_value, to_value, note, created_by)
    VALUES (p_car_id, 'status_changed', v_car.status::TEXT, p_new_status::TEXT, p_note, p_user_id);
  END IF;

  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_car to accept location_floor
CREATE OR REPLACE FUNCTION create_car(
  p_vin TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_model_year INTEGER DEFAULT NULL,
  p_exterior_color TEXT DEFAULT NULL,
  p_interior_color TEXT DEFAULT NULL,
  p_location_type location_type DEFAULT 'storage',
  p_location_slot TEXT DEFAULT NULL,
  p_location_floor TEXT DEFAULT NULL,
  p_status car_status DEFAULT 'inbound',
  p_user_id UUID DEFAULT NULL
)
RETURNS cars AS $$
DECLARE
  v_car cars;
BEGIN
  INSERT INTO cars (
    vin, brand, model, model_year,
    exterior_color, interior_color,
    location_type, location_slot, location_floor, status,
    created_by
  ) VALUES (
    p_vin, p_brand, p_model, p_model_year,
    p_exterior_color, p_interior_color,
    p_location_type, p_location_slot, p_location_floor, p_status,
    p_user_id
  )
  RETURNING * INTO v_car;

  INSERT INTO car_events (car_id, event_type, to_value, note, created_by)
  VALUES (v_car.id, 'created', 'VIN: ' || p_vin, 'Car added to inventory', p_user_id);

  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to include location_floor
CREATE OR REPLACE FUNCTION cars_set_changed_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.location_type IS DISTINCT FROM NEW.location_type
     OR OLD.location_slot IS DISTINCT FROM NEW.location_slot
     OR OLD.location_floor IS DISTINCT FROM NEW.location_floor THEN
    NEW.location_changed_at := NOW();
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate cars_display view with location_floor in location_full
DROP VIEW IF EXISTS cars_with_sales;
DROP VIEW IF EXISTS cars_display;

CREATE VIEW cars_display AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT
    || (CASE WHEN c.location_floor IS NOT NULL AND TRIM(c.location_floor) != '' THEN ' - ' || c.location_floor ELSE '' END)
    || (CASE WHEN c.location_slot IS NOT NULL AND TRIM(c.location_slot) != '' THEN ' - ' || c.location_slot ELSE '' END)
  AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%' ELSE '-' END AS battery_display,
  CASE WHEN c.current_km IS NOT NULL THEN c.current_km || ' km' ELSE '-' END AS km_display,
  CASE WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived) ELSE NULL END AS days_in_inventory,
  CASE WHEN c.price IS NOT NULL THEN TRIM(TO_CHAR(c.price, 'FM999,999,999.00')) || ' ' || COALESCE(c.price_currency, 'USD') ELSE '-' END AS price_display,
  CASE
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry > CURRENT_DATE THEN (c.warranty_expiry - CURRENT_DATE) || ' days'
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry <= CURRENT_DATE THEN 'Expired'
    ELSE '-'
  END AS warranty_display,
  CASE WHEN c.customs_status IS NOT NULL THEN INITCAP(REPLACE(c.customs_status::TEXT, '_', ' ')) ELSE '-' END AS customs_display
FROM cars c
WHERE c.deleted_at IS NULL;

CREATE VIEW cars_with_sales AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT
    || (CASE WHEN c.location_floor IS NOT NULL AND TRIM(c.location_floor) != '' THEN ' - ' || c.location_floor ELSE '' END)
    || (CASE WHEN c.location_slot IS NOT NULL AND TRIM(c.location_slot) != '' THEN ' - ' || c.location_slot ELSE '' END)
  AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%' ELSE '-' END AS battery_display,
  CASE WHEN c.current_km IS NOT NULL THEN c.current_km || ' km' ELSE '-' END AS km_display,
  CASE WHEN c.date_arrived IS NOT NULL THEN (CURRENT_DATE - c.date_arrived) ELSE NULL END AS days_in_inventory,
  CASE WHEN c.price IS NOT NULL THEN TRIM(TO_CHAR(c.price, 'FM999,999,999.00')) || ' ' || COALESCE(c.price_currency, 'USD') ELSE '-' END AS price_display,
  CASE
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry > CURRENT_DATE THEN (c.warranty_expiry - CURRENT_DATE) || ' days'
    WHEN c.warranty_expiry IS NOT NULL AND c.warranty_expiry <= CURRENT_DATE THEN 'Expired'
    ELSE '-'
  END AS warranty_display,
  CASE WHEN c.customs_status IS NOT NULL THEN INITCAP(REPLACE(c.customs_status::TEXT, '_', ' ')) ELSE '-' END AS customs_display,
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
