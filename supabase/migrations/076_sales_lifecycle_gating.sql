-- Sprint 2 of the workflow audit: server-side enforcement of the sales
-- lifecycle. Closes audit findings C1, C2, H1, H3.
--
-- Until now, every gate ("can't accept a quote without sending it",
-- "can't deliver before a deposit is paid", "deposit can't exceed
-- selling price") was enforced only in client JS. A direct PostgREST
-- call could bypass them and corrupt the data.

-- 0) Backfill: there's exactly one legacy row with status='delivered' but
--    every lifecycle timestamp NULL (created in Feb 2026, before the
--    lifecycle was instrumented). Fill all four timestamps with created_at
--    so the new invariants accept it. Treating the legacy delivery as
--    having happened "all at once" on the original date is the least bad
--    approximation we can do.
UPDATE public.sales_orders
   SET quote_sent_at      = COALESCE(quote_sent_at,      created_at),
       quote_accepted_at  = COALESCE(quote_accepted_at,  created_at),
       deposit_paid_at    = COALESCE(deposit_paid_at,    created_at),
       contract_signed_at = COALESCE(contract_signed_at, created_at),
       delivered_at       = COALESCE(delivered_at,       updated_at, created_at)
 WHERE status = 'delivered' AND delivered_at IS NULL;

-- 1) Lifecycle invariants. Each is a logical implication on the row.
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_lifecycle_quote_accept,
  DROP CONSTRAINT IF EXISTS sales_orders_lifecycle_contract_after_deposit,
  DROP CONSTRAINT IF EXISTS sales_orders_lifecycle_delivered_after_deposit_contract,
  DROP CONSTRAINT IF EXISTS sales_orders_deposit_not_over_price,
  DROP CONSTRAINT IF EXISTS sales_orders_status_delivered_iff_timestamp;

-- "You can't have an accepted quote without a sent quote." (audit H3)
ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_lifecycle_quote_accept
  CHECK (quote_accepted_at IS NULL OR quote_sent_at IS NOT NULL);

-- "You can't have a signed contract without a paid deposit."
ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_lifecycle_contract_after_deposit
  CHECK (
    contract_signed_at IS NULL
    OR deposit_paid_at IS NOT NULL
  );

-- "You can't be delivered without a paid deposit AND a signed contract." (audit C1)
ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_lifecycle_delivered_after_deposit_contract
  CHECK (
    delivered_at IS NULL
    OR (deposit_paid_at IS NOT NULL AND contract_signed_at IS NOT NULL)
  );

-- "Deposit can't exceed selling price." (audit H1)
ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_deposit_not_over_price
  CHECK (
    deposit_amount IS NULL
    OR selling_price IS NULL
    OR deposit_amount <= selling_price
  );

-- "status='delivered' iff delivered_at IS NOT NULL." (audit C2)
-- Blocks the case where someone sets status='delivered' via the dropdown
-- without going through complete_delivery() and its gating.
ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_status_delivered_iff_timestamp
  CHECK (
    (status = 'delivered'::sale_status) = (delivered_at IS NOT NULL)
  );

-- 2) Harden the complete_delivery RPC: verify the gates before flipping
--    delivered_at, with clear human-readable errors so the UI can surface
--    them instead of cryptic CHECK constraint violations.
CREATE OR REPLACE FUNCTION public.complete_delivery(p_sales_order_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_so     public.sales_orders;
  v_caller uuid := auth.uid();
begin
  perform public._require_any_capability(array['sales'::user_capability]);

  select * into v_so from public.sales_orders where id = p_sales_order_id for update;
  if not found then
    raise exception 'sales_order % not found', p_sales_order_id using errcode = '02000';
  end if;
  if v_so.delivered_at is not null then
    raise exception 'Already delivered at %', v_so.delivered_at using errcode = '40000';
  end if;

  -- Lifecycle gates: enforce the same checks the new CHECK constraints
  -- enforce, but with friendlier error messages so the UI can surface them.
  if v_so.quote_sent_at is null then
    raise exception 'Quote must be sent before delivery' using errcode = '23514';
  end if;
  if v_so.deposit_paid_at is null then
    raise exception 'Deposit must be recorded before delivery' using errcode = '23514';
  end if;
  if v_so.contract_signed_at is null then
    raise exception 'Signed contract must be recorded before delivery' using errcode = '23514';
  end if;

  update public.sales_orders
     set delivered_at   = now(),
         delivered_by   = v_caller,
         delivery_notes = p_notes,
         status         = 'delivered'::sale_status,
         updated_at     = now()
   where id = p_sales_order_id;

  if v_so.customer_id is not null then
    update public.customers
       set lead_status = 'converted'::lead_status, updated_at = now()
     where id = v_so.customer_id
       and lead_status not in ('converted','lost');
  end if;

  if v_so.car_id is not null then
    insert into public.car_events (car_id, event_type, to_value, note, created_by)
    values (
      v_so.car_id,
      'status_changed'::car_event_type,
      'delivered',
      coalesce('Delivery: ' || p_notes, 'Delivery completed'),
      v_caller
    );
  end if;
end;
$function$;
