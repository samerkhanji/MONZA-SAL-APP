-- ============================================
-- MONZA TECH CRM - Add customs amount paid
-- Migration 008
-- ============================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS customs_amount_paid DECIMAL(12, 2);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS customs_amount_currency TEXT DEFAULT 'USD';

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_customs_amount_non_negative;
ALTER TABLE cars ADD CONSTRAINT cars_customs_amount_non_negative
  CHECK (customs_amount_paid IS NULL OR customs_amount_paid >= 0);

COMMENT ON COLUMN cars.customs_amount_paid IS 'Amount paid for customs clearance';
COMMENT ON COLUMN cars.customs_amount_currency IS 'Currency for customs amount';
