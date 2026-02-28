-- ============================================
-- MONZA CRM - Fix wrong VIN links for OMAR HAOUCHI
-- Migration 013: Remove incorrect car-to-customer associations
--
-- Problem: Customer OMAR HAOUCHI correctly owns VIN LDP95H969PE309648 (Voyah FREE 2023, Sold).
-- Two wrong cars were incorrectly linked to him:
--   - LDP95C969SY890014 (Voyah COURAGE 2025, belongs to GEORGES HRAOUI)
--   - LDP95H961SE900260 (Voyah FREE 2025, belongs to MOHAMAD KASSEM)
--
-- This migration removes those wrong sales_orders links.
-- ============================================

-- Delete sales_orders that incorrectly link OMAR HAOUCHI to the wrong cars
DELETE FROM sales_orders
WHERE customer_id = (
  SELECT id FROM customers
  WHERE first_name ILIKE 'Omar' AND last_name ILIKE '%Haouchi%'
  LIMIT 1
)
AND car_id IN (
  SELECT id FROM cars WHERE vin IN ('LDP95C969SY890014', 'LDP95H961SE900260')
);
