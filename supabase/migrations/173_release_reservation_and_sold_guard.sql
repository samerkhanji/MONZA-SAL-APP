-- ============================================
-- Monza S.A.L. — Operational audit Batch 2 (2026-06-11)
-- Fixes two related workflow bugs found in the audit:
--  * Un-reserving a car via the quick status select left its sales_order
--    active and orphaned (mig 108 unique index then blocked the next sale).
--  * 'sold'/'reserved' cars could be flipped back to a sellable status with
--    an active order still attached — no reason, no order cleanup.
--
-- 1) release_car_reservation(): the supported way for sales to free a car —
--    cancels the active (non-delivered, non-deposit) order WITH a reason and
--    returns the car to 'available', atomically.
-- 2) A guard trigger blocks the unsafe direct path (reserved/sold -> a
--    sellable status while an active order exists) for non-owners, pointing
--    them at the RPC. Owners keep a manual override.
-- Idempotent.
-- ============================================

create or replace function public.release_car_reservation(p_car_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order public.sales_orders%rowtype;
begin
  if not (public.is_owner() or public.has_capability('sales'::user_capability)) then
    raise exception 'Not authorized to release reservations' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to release a reservation';
  end if;

  select * into v_order
  from public.sales_orders
  where car_id = p_car_id
    and status not in ('cancelled','delivered')
  order by created_at desc
  limit 1;

  if found then
    if v_order.deposit_paid_at is not null then
      raise exception 'This reservation has a deposit recorded. Use the owner void/refund flow instead of release.';
    end if;
    update public.sales_orders
       set status = 'cancelled',
           void_at = now(),
           void_by = auth.uid(),
           void_reason = p_reason,
           updated_at = now()
     where id = v_order.id;
  end if;

  -- Order is now cancelled (or never existed), so the orphan guard below
  -- passes. Forward the car back to sellable stock.
  update public.cars
     set status = 'available', status_changed_at = now()
   where id = p_car_id
     and status in ('reserved','sold');
end;
$$;

revoke all on function public.release_car_reservation(uuid, text) from public;
grant execute on function public.release_car_reservation(uuid, text) to authenticated;

comment on function public.release_car_reservation(uuid, text) is
  'Cancels a car''s active (non-deposit) sales order with a reason and returns the car to available. Owner or sales capability.';

-- Guard: stop a car with an active order from being flipped back to a
-- sellable status directly (which orphans the order). Owner override kept.
create or replace function public.cars_block_orphan_reservation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('reserved','sold')
     and new.status in ('available','inventory','in_stock','showroom')
     and not public.is_owner()
     and exists (
       select 1 from public.sales_orders so
       where so.car_id = new.id
         and so.status not in ('cancelled','delivered')
     )
  then
    raise exception 'This car has an active sales order. Use "Release reservation" (which cancels the order) instead of changing the status directly.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cars_block_orphan_reservation on public.cars;
create trigger trg_cars_block_orphan_reservation
before update of status on public.cars
for each row execute function public.cars_block_orphan_reservation();
