-- ============================================
-- MONZA TECH CRM - Add sub dealer name
-- Migration 009
-- ============================================
-- When status is 'sent_to_sub_dealer', store which sub dealer received the car

ALTER TABLE cars ADD COLUMN IF NOT EXISTS sub_dealer_name TEXT;

COMMENT ON COLUMN cars.sub_dealer_name IS 'Name of sub dealer when status is sent_to_sub_dealer';
