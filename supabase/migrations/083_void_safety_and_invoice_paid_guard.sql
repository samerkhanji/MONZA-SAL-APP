-- Wave 6 of the deep audit:
--
-- S1: void_sales_order returned the car to 'available' but didn't check
--     whether the same car was already linked to another non-cancelled
--     sales_order. Returning to inventory while the car was still under
--     contract elsewhere created an orphaned active sale that quietly
--     pointed at a car the system thought was available.
--
-- S2: invoices.status could be flipped to 'paid' via direct UPDATE without
--     paid_amount catching up to total_amount. That broke downstream
--     receivables reports.

-- ============================================================================
-- S1: tighten void_sales_order
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_sales_order(p_sales_order_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_so     public.sales_orders;
  v_caller uuid := auth.uid();
  v_other_sale uuid;
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

  -- If the order was delivered, return the car to inventory ONLY if no
  -- other active (non-cancelled, non-delivered) sale references the same car.
  if v_so.delivered_at is not null and v_so.car_id is not null then
    select id into v_other_sale
      from public.sales_orders
     where car_id = v_so.car_id
       and id <> p_sales_order_id
       and status not in ('cancelled'::sale_status, 'delivered'::sale_status)
     limit 1;

    if v_other_sale is null then
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
    else
      -- Don't lie about availability when another contract is still in flight.
      insert into public.car_events (car_id, event_type, to_value, note, created_by)
      values (
        v_so.car_id,
        'status_changed'::car_event_type,
        v_so.car_id::text,
        'Voided sale ' || p_sales_order_id::text || '; car retained on order ' || v_other_sale::text,
        v_caller
      );
    end if;
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

-- ============================================================================
-- S2: invoices_check_paid_transition
-- Block status='paid' unless paid_amount >= total_amount.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoices_check_paid_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status, '') <> 'paid' THEN
    IF NEW.paid_amount IS NULL OR NEW.paid_amount < NEW.total_amount THEN
      RAISE EXCEPTION
        'Cannot mark invoice as paid: paid_amount (%) is less than total_amount (%)',
        COALESCE(NEW.paid_amount, 0), NEW.total_amount
        USING errcode = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_invoices_check_paid_transition ON public.invoices;
CREATE TRIGGER trg_invoices_check_paid_transition
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.invoices_check_paid_transition();
