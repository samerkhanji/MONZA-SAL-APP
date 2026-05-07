-- Sprint 5 of the workflow audit: multi-currency cleanup + sales reversal flow.
--
-- Closes audit findings:
--   H2 — sales orders could mix currencies (quote USD, deposit LBP, sale EUR).
--        Reports were summing different currencies under one label.
--   H6 — once `delivered_at` was set, an order was locked. No reversal/refund
--        flow existed; owner had to edit the DB by hand.

-- ============================================================================
-- H2: enforce consistent currency within a single sales_order.
-- All amount-currency fields, when set, must equal each other or be NULL.
-- The UI is being switched to a single currency dropdown per order;
-- this CHECK is the safety net.
-- ============================================================================

ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_currencies_consistent;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_currencies_consistent
  CHECK (
    -- quote vs main
    (quote_currency IS NULL OR currency IS NULL OR quote_currency = currency)
    AND
    -- deposit vs main
    (deposit_currency IS NULL OR currency IS NULL OR deposit_currency = currency)
    AND
    -- quote vs deposit (in case main is NULL on legacy rows)
    (quote_currency IS NULL OR deposit_currency IS NULL OR quote_currency = deposit_currency)
  );

-- ============================================================================
-- H6: sales reversal/void flow.
-- ============================================================================

-- 1) Audit columns for the void event.
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS void_at      timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason  text,
  ADD COLUMN IF NOT EXISTS void_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Relax the (status='delivered') = (delivered_at IS NOT NULL) constraint
--    that migration 076 added. The forward direction (no status=delivered
--    without delivered_at) still must hold; the reverse no longer needs to
--    because a voided/cancelled order keeps its delivered_at for history.
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_status_delivered_iff_timestamp;

ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_status_delivered_requires_timestamp;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_status_delivered_requires_timestamp
  CHECK (NOT (status = 'delivered'::sale_status AND delivered_at IS NULL));

-- 3) The void RPC. Owner-only. Atomically:
--    - sets status='cancelled', void_at=now(), void_reason, void_by
--    - if the order had a delivered car: returns the car to status='available'
--      and inserts a car_event recording the reversal
--    - if the customer was auto-marked 'converted' by complete_delivery:
--      reverts them to 'interested'

CREATE OR REPLACE FUNCTION public.void_sales_order(p_sales_order_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_so     public.sales_orders;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if not public.is_owner() then
    raise exception 'Only owners can void a sale' using errcode = '42501';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to void a sale' using errcode = '23514';
  end if;

  select * into v_so from public.sales_orders where id = p_sales_order_id for update;
  if not found then
    raise exception 'sales_order % not found', p_sales_order_id using errcode = '02000';
  end if;
  if v_so.status = 'cancelled'::sale_status then
    raise exception 'Sale is already cancelled' using errcode = '40000';
  end if;

  update public.sales_orders
     set status      = 'cancelled'::sale_status,
         void_at     = now(),
         void_reason = p_reason,
         void_by     = v_caller,
         updated_at  = now()
   where id = p_sales_order_id;

  -- If the order was delivered, return the car to inventory.
  if v_so.delivered_at is not null and v_so.car_id is not null then
    update public.cars
       set status = 'available'::car_status,
           updated_at = now()
     where id = v_so.car_id;

    insert into public.car_events (car_id, event_type, to_value, note, created_by)
    values (
      v_so.car_id,
      'status_changed'::car_event_type,
      'available',
      'Sale voided. Reason: ' || p_reason,
      v_caller
    );
  end if;

  -- If the customer was auto-converted by complete_delivery, revert lead status.
  if v_so.delivered_at is not null and v_so.customer_id is not null then
    update public.customers
       set lead_status = 'interested'::lead_status, updated_at = now()
     where id = v_so.customer_id
       and lead_status = 'converted';
  end if;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.void_sales_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_sales_order(uuid, text) TO authenticated;
