-- Audit 1: cars with legacy client_name but no relational sales_orders link
SELECT c.*
FROM public.cars c
LEFT JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
WHERE c.client_name IS NOT NULL
  AND TRIM(c.client_name) <> ''
  AND c.deleted_at IS NULL
  AND so.id IS NULL;

-- Audit 2: cars in sold / delivered / reserved status with no sales_orders row
SELECT c.*
FROM public.cars c
LEFT JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
WHERE c.status IN ('sold', 'delivered', 'reserved')
  AND c.deleted_at IS NULL
  AND so.id IS NULL;

-- Audit 3: customers missing primary phone number
SELECT *
FROM public.customers
WHERE phone_primary IS NULL
   OR TRIM(phone_primary) = '';

-- Audit 4: duplicate customers by phone_primary
SELECT phone_primary, COUNT(*) AS cnt, ARRAY_AGG(id) AS customer_ids
FROM public.customers
WHERE phone_primary IS NOT NULL
  AND TRIM(phone_primary) <> ''
GROUP BY phone_primary
HAVING COUNT(*) > 1;

-- Audit 5: cars where relational customer disagrees with legacy client_name/phone
SELECT
  c.id,
  c.vin,
  c.client_name       AS car_client_name,
  c.client_phone      AS car_client_phone,
  so.id               AS sales_order_id,
  cust.first_name,
  cust.last_name,
  cust.phone_primary
FROM public.cars c
JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
JOIN public.customers cust
  ON cust.id = so.customer_id
WHERE (
   c.client_name IS NOT NULL
   AND TRIM(c.client_name) <> ''
   AND TRIM(c.client_name) <> TRIM(CONCAT(cust.first_name, ' ', COALESCE(cust.last_name, '')))
)
OR (
   c.client_phone IS NOT NULL
   AND TRIM(c.client_phone) <> ''
   AND TRIM(c.client_phone) <> TRIM(cust.phone_primary)
);

