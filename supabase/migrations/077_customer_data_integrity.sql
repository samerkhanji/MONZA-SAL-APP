-- Sprint 3 of the workflow audit: customer data integrity.
--
-- Closes audit findings:
--   C5 — duplicate customers had no detection or constraint
--   C6 — phone numbers were not normalized
--   H4 — customer soft-delete orphaned non-cancelled sales orders

-- 1) Normalize-phone helper. Strips whitespace, dashes, parens, dots, etc.
--    Keeps a leading + if present (international prefix). Empty -> NULL.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p IS NULL OR trim(p) = '' THEN NULL
    WHEN substr(trim(p), 1, 1) = '+' THEN
      '+' || regexp_replace(substr(trim(p), 2), '[^\d]', '', 'g')
    ELSE
      regexp_replace(trim(p), '[^\d]', '', 'g')
  END
$$;

-- 2) Unique partial index on normalized phone (active customers only).
--    Doesn't include rows with NULL/empty phone, doesn't include soft-deleted
--    rows. The frontend will pre-check before insert to give a friendly
--    "this customer already exists" message; this index is the safety net.
DROP INDEX IF EXISTS public.uq_customers_phone_primary_normalized;
CREATE UNIQUE INDEX uq_customers_phone_primary_normalized
  ON public.customers (public.normalize_phone(phone_primary))
  WHERE deleted_at IS NULL
    AND phone_primary IS NOT NULL
    AND trim(phone_primary) <> '';

-- 3) Block customer soft-delete when they still have active sales orders.
--    "Active" = not cancelled and not delivered (delivered orders are
--    historical record; we shouldn't block deletion on those).
CREATE OR REPLACE FUNCTION public.tg_customers_block_delete_with_active_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_active_count int;
BEGIN
  -- Only fire on the transition INTO soft-deleted.
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    SELECT count(*) INTO v_active_count
      FROM public.sales_orders
     WHERE customer_id = NEW.id
       AND status NOT IN ('cancelled', 'delivered');
    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete customer with % active sales order(s). Cancel or finish them first.',
        v_active_count USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_customers_block_delete_with_active_orders() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_customers_block_delete_with_active_orders ON public.customers;
CREATE TRIGGER trg_customers_block_delete_with_active_orders
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_customers_block_delete_with_active_orders();
