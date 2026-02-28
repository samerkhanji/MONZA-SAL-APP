-- ============================================
-- MONZA CRM - Verify VIN/Customer Links
-- Run this against your Supabase database to find potential issues
-- ============================================

-- 1. Find customers linked to multiple cars (may be valid - one customer can buy multiple cars)
SELECT
  c.id AS customer_id,
  c.first_name,
  c.last_name,
  COUNT(so.id) AS car_count,
  STRING_AGG(car.vin, ', ' ORDER BY car.vin) AS vins
FROM customers c
JOIN sales_orders so ON so.customer_id = c.id AND so.status != 'cancelled'
JOIN cars car ON car.id = so.car_id
GROUP BY c.id, c.first_name, c.last_name
HAVING COUNT(so.id) > 1
ORDER BY car_count DESC;

-- 2. Find cars linked to multiple customers (should never happen - data error)
SELECT
  car.id AS car_id,
  car.vin,
  car.client_name,
  car.status,
  COUNT(DISTINCT so.customer_id) AS customer_count,
  STRING_AGG(DISTINCT cust.first_name || ' ' || COALESCE(cust.last_name, ''), ' | ') AS customers
FROM cars car
JOIN sales_orders so ON so.car_id = car.id AND so.status != 'cancelled'
JOIN customers cust ON cust.id = so.customer_id
GROUP BY car.id, car.vin, car.client_name, car.status
HAVING COUNT(DISTINCT so.customer_id) > 1;

-- 3. OMAR HAOUCHI diagnostic - what cars are linked to him?
SELECT
  cust.first_name,
  cust.last_name,
  car.vin,
  car.model,
  car.model_year,
  car.status,
  car.client_name AS car_client_name
FROM customers cust
JOIN sales_orders so ON so.customer_id = cust.id AND so.status != 'cancelled'
JOIN cars car ON car.id = so.car_id
WHERE cust.first_name ILIKE '%Omar%' AND cust.last_name ILIKE '%Haouchi%';
