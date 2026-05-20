-- ============================================
-- MONZA CRM - Incoming car shipment tracking
-- Migration 139
--
-- The Ordered Cars page tracks cars that have been ordered and are
-- inbound (car status 'inbound') with their shipment code and estimated
-- arrival date. When a car arrives it is marked as in inventory and
-- drops off the ordered-cars list. Additive, nullable columns -- safe.
--
-- Applied to live project okxpsvukzjjubinhamek as
-- `cars_incoming_shipment_tracking`.
-- ============================================

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS incoming_eta  date,
  ADD COLUMN IF NOT EXISTS shipment_code text;
