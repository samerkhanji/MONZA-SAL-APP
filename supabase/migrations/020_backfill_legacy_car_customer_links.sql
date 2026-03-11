-- ============================================
-- MONZA CRM - Backfill legacy car/customer links
-- Migration 020: create customers and sales_orders
-- from cars.client_name / cars.client_phone
-- without creating duplicates.
-- ============================================

-- 1) Create missing customers from legacy cars data
INSERT INTO public.customers (
  first_name,
  last_name,
  phone_primary,
  email,
  lead_status,
  lead_source,
  created_by
)
SELECT
  split_part(TRIM(c.client_name), ' ', 1) AS first_name,
  NULLIF(
    REGEXP_REPLACE(TRIM(c.client_name), '^[^ ]+\\s*', ''),
    ''
  ) AS last_name,
  NULLIF(TRIM(c.client_phone), '') AS phone_primary,
  NULL,                              -- legacy has no email
  'converted'::public.lead_status,
  NULL,                              -- unknown source
  c.created_by
FROM public.cars c
LEFT JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
LEFT JOIN public.customers existing
  ON existing.phone_primary = c.client_phone
WHERE c.client_name IS NOT NULL
  AND TRIM(c.client_name) <> ''
  AND c.deleted_at IS NULL
  AND so.id IS NULL              -- no sales_orders yet for this car
  AND existing.id IS NULL;       -- avoid duplicating by phone


-- 2) Create sales_orders rows linking cars and customers
INSERT INTO public.sales_orders (
  car_id,
  customer_id,
  status,
  selling_price,
  currency,
  sale_date,
  delivery_date,
  reservation_date,
  reserved_by,
  deposit_amount,
  notes,
  created_by
)
SELECT
  c.id AS car_id,
  cust.id AS customer_id,
  CASE
    WHEN c.status = 'reserved' THEN 'reserved'
    ELSE 'confirmed'
  END AS status,
  NULL::NUMERIC AS selling_price,
  c.price_currency AS currency,
  COALESCE(c.delivery_date, c.date_arrived) AS sale_date,
  c.delivery_date,
  c.reservation_date,
  c.reserved_by,
  NULL::NUMERIC AS deposit_amount,
  'Backfilled from legacy client_name/client_phone on cars' AS notes,
  c.created_by
FROM public.cars c
JOIN public.customers cust
  ON (
       (c.client_phone IS NOT NULL AND TRIM(c.client_phone) <> '' AND cust.phone_primary = TRIM(c.client_phone))
       OR (
         (c.client_phone IS NULL OR TRIM(c.client_phone) = '')
         AND c.client_name IS NOT NULL
         AND TRIM(c.client_name) = TRIM(CONCAT(cust.first_name, ' ', COALESCE(cust.last_name, '')))
       )
     )
LEFT JOIN public.sales_orders so
  ON so.car_id = c.id
 AND so.status <> 'cancelled'
WHERE c.client_name IS NOT NULL
  AND TRIM(c.client_name) <> ''
  AND c.deleted_at IS NULL
  AND so.id IS NULL;

