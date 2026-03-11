-- Nullify placeholder phones (0000, 0001, 0002, etc.) so they are not treated as real numbers
-- Pattern: short numeric strings starting with 0 (e.g. 0, 00, 000, 0000, 0001, 0010)

-- Customers: set phone_primary to NULL where it's a placeholder (0000, 0001, etc.)
UPDATE public.customers
SET phone_primary = NULL, updated_at = NOW()
WHERE deleted_at IS NULL
  AND phone_primary IS NOT NULL
  AND TRIM(phone_primary) <> ''
  AND (phone_primary ~ '^0+$' OR phone_primary ~ '^0[0-9]{0,5}$');

-- Cars: set client_phone to NULL where it's a placeholder (legacy field, read-only going forward)
UPDATE public.cars
SET client_phone = NULL, updated_at = NOW()
WHERE deleted_at IS NULL
  AND client_phone IS NOT NULL
  AND TRIM(client_phone) <> ''
  AND (client_phone ~ '^0+$' OR client_phone ~ '^0[0-9]{0,5}$');
