-- Data Health audit views for CRM → Data Health dashboard
-- These views power the data health checks so assistants can clean data without SQL

-- 1. Sold/delivered/reserved cars without sales_order (broken workflow)
CREATE OR REPLACE VIEW public.data_health_sold_car_without_sales_order AS
SELECT
  c.id,
  c.vin,
  c.brand,
  c.model,
  c.model_year,
  c.status,
  c.client_name AS legacy_client_name,
  c.client_phone AS legacy_client_phone
FROM public.cars c
LEFT JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
WHERE c.status IN ('sold', 'delivered', 'reserved')
  AND c.deleted_at IS NULL
  AND so.id IS NULL;

-- 2. Customers without phone (missing contact)
CREATE OR REPLACE VIEW public.data_health_customer_without_phone AS
SELECT
  id,
  first_name,
  last_name,
  email,
  lead_status,
  created_at
FROM public.customers
WHERE deleted_at IS NULL
  AND (phone_primary IS NULL OR TRIM(phone_primary) = '' OR phone_primary = 'N/A');

-- 3. Duplicate customer names (CRM cleanup needed)
CREATE OR REPLACE VIEW public.data_health_duplicate_customer_names AS
SELECT
  TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) AS full_name,
  COUNT(*) AS cnt,
  ARRAY_AGG(id ORDER BY created_at) AS customer_ids
FROM public.customers
WHERE deleted_at IS NULL
  AND first_name IS NOT NULL
  AND TRIM(first_name) <> ''
GROUP BY TRIM(CONCAT(first_name, ' ', COALESCE(last_name, '')))
HAVING COUNT(*) > 1;

-- 4. Cars without VIN (inventory issue)
CREATE OR REPLACE VIEW public.data_health_car_without_vin AS
SELECT
  id,
  brand,
  model,
  model_year,
  status,
  created_at
FROM public.cars
WHERE deleted_at IS NULL
  AND (vin IS NULL OR TRIM(vin) = '' OR length(vin) <> 17);

-- 5. Customers with multiple sales orders (review)
CREATE OR REPLACE VIEW public.data_health_customer_multiple_sales AS
SELECT
  cust.id AS customer_id,
  cust.first_name,
  cust.last_name,
  cust.phone_primary,
  COUNT(so.id) AS sales_count,
  ARRAY_AGG(so.id) AS sales_order_ids
FROM public.customers cust
JOIN public.sales_orders so ON so.customer_id = cust.id
WHERE cust.deleted_at IS NULL
  AND so.status <> 'cancelled'
GROUP BY cust.id, cust.first_name, cust.last_name, cust.phone_primary
HAVING COUNT(so.id) > 1;

-- 6. Placeholder phones (0000, 0001, etc.) - for display in dashboard
CREATE OR REPLACE VIEW public.data_health_placeholder_phones AS
SELECT id, first_name, last_name, phone_primary, 'customers' AS source_table
FROM public.customers
WHERE deleted_at IS NULL
  AND phone_primary IS NOT NULL
  AND TRIM(phone_primary) <> ''
  AND (phone_primary ~ '^0+$' OR phone_primary ~ '^0[0-9]{0,5}$')
UNION ALL
SELECT c.id, c.client_name AS first_name, NULL::text AS last_name, c.client_phone AS phone_primary, 'cars' AS source_table
FROM public.cars c
WHERE c.deleted_at IS NULL
  AND c.client_phone IS NOT NULL
  AND TRIM(c.client_phone) <> ''
  AND (c.client_phone ~ '^0+$' OR c.client_phone ~ '^0[0-9]{0,5}$');

-- Grant read access to authenticated users (RLS will apply per-role)
GRANT SELECT ON public.data_health_sold_car_without_sales_order TO authenticated;
GRANT SELECT ON public.data_health_customer_without_phone TO authenticated;
GRANT SELECT ON public.data_health_duplicate_customer_names TO authenticated;
GRANT SELECT ON public.data_health_car_without_vin TO authenticated;
GRANT SELECT ON public.data_health_customer_multiple_sales TO authenticated;
GRANT SELECT ON public.data_health_placeholder_phones TO authenticated;
