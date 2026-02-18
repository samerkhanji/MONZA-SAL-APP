-- ============================================
-- MONZA TECH CRM - Car Inventory Schema
-- Migration 001: Core car inventory tables
-- ============================================

-- ============================================
-- ENUMS (strict values, no random data)
-- ============================================

-- Car lifecycle status (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'car_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.car_status AS ENUM (
      'inbound',
      'in_stock',
      'showroom',
      'reserved',
      'sold',
      'delivered',
      'service'
    );
  END IF;
END;
$$;

-- Physical location type (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'location_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.location_type AS ENUM (
      'showroom1',
      'showroom2',
      'garage',
      'storage'
    );
  END IF;
END;
$$;

-- PDI status (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pdi_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pdi_status AS ENUM (
      'pending',
      'in_progress',
      'done'
    );
  END IF;
END;
$$;

-- Car event type (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'car_event_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.car_event_type AS ENUM (
      'created',
      'moved',
      'status_changed',
      'battery_updated',
      'pdi_updated',
      'details_updated',
      'note_added'
    );
  END IF;
END;
$$;

-- ============================================
-- CARS TABLE (current state only)
-- ============================================

CREATE TABLE IF NOT EXISTS public.cars (
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
  status public.car_status NOT NULL DEFAULT 'inbound',

  -- Location (physical position)
  location_type public.location_type NOT NULL DEFAULT 'storage',
  location_slot TEXT,                     -- e.g., "S1-R3-C12", "Garage-Bay2"

  -- EV / Technical specs
  battery_percent INTEGER CHECK (battery_percent >= 0 AND battery_percent <= 100),
  ev_range_km INTEGER,
  motor TEXT,
  software_version TEXT,

  -- PDI / Readiness
  pdi_status public.pdi_status NOT NULL DEFAULT 'pending',

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

CREATE TABLE IF NOT EXISTS public.car_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,

  -- What happened
  event_type public.car_event_type NOT NULL,

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

CREATE INDEX IF NOT EXISTS idx_cars_vin ON public.cars(vin);
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_location_type ON public.cars(location_type);
CREATE INDEX IF NOT EXISTS idx_cars_brand_model ON public.cars(brand, model);
CREATE INDEX IF NOT EXISTS idx_cars_created_at ON public.cars(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_car_events_car_id ON public.car_events(car_id);
CREATE INDEX IF NOT EXISTS idx_car_events_event_type ON public.car_events(event_type);
CREATE INDEX IF NOT EXISTS idx_car_events_created_at ON public.car_events(created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'cars_updated_at'
  ) THEN
    CREATE TRIGGER cars_updated_at
      BEFORE UPDATE ON public.cars
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cars'
      AND policyname = 'Authenticated users can view all cars'
  ) THEN
    CREATE POLICY "Authenticated users can view all cars"
      ON public.cars FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cars'
      AND policyname = 'Authenticated users can insert cars'
  ) THEN
    CREATE POLICY "Authenticated users can insert cars"
      ON public.cars FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cars'
      AND policyname = 'Authenticated users can update cars'
  ) THEN
    CREATE POLICY "Authenticated users can update cars"
      ON public.cars FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'car_events'
      AND policyname = 'Authenticated users can view all car events'
  ) THEN
    CREATE POLICY "Authenticated users can view all car events"
      ON public.car_events FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'car_events'
      AND policyname = 'Authenticated users can insert car events'
  ) THEN
    CREATE POLICY "Authenticated users can insert car events"
      ON public.car_events FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END;
$$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.move_car(
  p_car_id UUID,
  p_new_location_type public.location_type,
  p_new_location_slot TEXT,
  p_new_status public.car_status DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS public.cars AS $$
DECLARE
  v_car public.cars;
  v_old_location TEXT;
  v_new_location TEXT;
  v_old_status public.car_status;
BEGIN
  -- SECURITY DEFINER safety
  PERFORM set_config('search_path', 'public', true);

  -- Get current car state
  SELECT * INTO v_car FROM public.cars WHERE id = p_car_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Car not found: %', p_car_id;
  END IF;

  v_old_status := v_car.status;

  -- Build location strings for event log
  v_old_location := v_car.location_type::TEXT || ':' || COALESCE(v_car.location_slot, '');
  v_new_location := p_new_location_type::TEXT || ':' || COALESCE(p_new_location_slot, '');

  -- Update car location
  UPDATE public.cars SET
    location_type = p_new_location_type,
    location_slot = p_new_location_slot,
    status = COALESCE(p_new_status, status)
  WHERE id = p_car_id
  RETURNING * INTO v_car;

  -- Log the move event
  INSERT INTO public.car_events (car_id, event_type, from_value, to_value, note, created_by)
  VALUES (p_car_id, 'moved', v_old_location, v_new_location, p_note, p_user_id);

  -- Log status change if applicable (compare old vs requested)
  IF p_new_status IS NOT NULL AND p_new_status <> v_old_status THEN
    INSERT INTO public.car_events (car_id, event_type, from_value, to_value, note, created_by)
    VALUES (p_car_id, 'status_changed', v_old_status::TEXT, p_new_status::TEXT, p_note, p_user_id);
  END IF;

  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_car(
  p_vin TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_model_year INTEGER DEFAULT NULL,
  p_exterior_color TEXT DEFAULT NULL,
  p_interior_color TEXT DEFAULT NULL,
  p_location_type public.location_type DEFAULT 'storage',
  p_location_slot TEXT DEFAULT NULL,
  p_status public.car_status DEFAULT 'inbound',
  p_user_id UUID DEFAULT NULL
)
RETURNS public.cars AS $$
DECLARE
  v_car public.cars;
BEGIN
  -- SECURITY DEFINER safety
  PERFORM set_config('search_path', 'public', true);

  INSERT INTO public.cars (
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

  INSERT INTO public.car_events (car_id, event_type, to_value, note, created_by)
  VALUES (v_car.id, 'created', 'VIN: ' || p_vin, 'Car added to inventory', p_user_id);

  RETURN v_car;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS (for easier querying)
-- ============================================

CREATE OR REPLACE VIEW public.cars_display AS
SELECT
  c.*,
  RIGHT(c.vin, 8) AS vin_short,
  c.location_type::TEXT || COALESCE(' - ' || c.location_slot, '') AS location_full,
  INITCAP(REPLACE(c.status::TEXT, '_', ' ')) AS status_display,
  CASE
    WHEN c.battery_percent IS NOT NULL THEN c.battery_percent || '%'
    ELSE '-'
  END AS battery_display
FROM public.cars c;

-- ============================================
-- COMMENTS (documentation)
-- ============================================

COMMENT ON TABLE public.cars IS 'Main car inventory table - one record per physical vehicle (identified by VIN)';
COMMENT ON TABLE public.car_events IS 'Audit trail for all car changes (location, status, etc.)';

COMMENT ON COLUMN public.cars.vin IS 'Vehicle Identification Number - unique identifier';
COMMENT ON COLUMN public.cars.location_type IS 'Physical location category';
COMMENT ON COLUMN public.cars.location_slot IS 'Specific slot/position within location (e.g., S1-R3-C12)';
COMMENT ON COLUMN public.cars.status IS 'Current lifecycle status';
COMMENT ON COLUMN public.cars.pdi_status IS 'Pre-Delivery Inspection status';

COMMENT ON FUNCTION public.move_car IS 'Atomic function to move a car - updates location AND logs event in one transaction';
COMMENT ON FUNCTION public.create_car IS 'Creates a new car record with automatic event logging';
