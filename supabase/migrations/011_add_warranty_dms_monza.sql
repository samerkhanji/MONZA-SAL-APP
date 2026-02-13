-- ============================================
-- MONZA TECH CRM - Add warranty per DMS and Monza start date
-- Migration 011
-- ============================================
-- Replace warranty life with: warranty as per DMS, warranty as per Monza starting date

ALTER TABLE cars ADD COLUMN IF NOT EXISTS warranty_per_dms DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS warranty_monza_start_date DATE;

COMMENT ON COLUMN cars.warranty_per_dms IS 'Warranty date as per DMS';
COMMENT ON COLUMN cars.warranty_monza_start_date IS 'Warranty starting date as per Monza';
