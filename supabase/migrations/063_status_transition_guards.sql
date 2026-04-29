-- 063: State-machine guards on status enums (terminal-state protection)
--
-- Block transitions OUT of terminal states. Everything else allowed.
-- `owner` role can always override for data corrections.

-- ---------- cars.status ------------------------------------------------------
create or replace function public.cars_block_terminal_status_revert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('delivered'::car_status, 'scrapped'::car_status) then
    if not public.is_owner() then
      raise exception 'cars.status is terminal; only owner can change it (was: %, attempted: %)',
        old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cars_block_terminal_status_revert on public.cars;
create trigger trg_cars_block_terminal_status_revert
before update of status on public.cars
for each row execute function public.cars_block_terminal_status_revert();

-- ---------- sales_orders.status ---------------------------------------------
create or replace function public.sales_orders_block_terminal_status_revert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('delivered'::sale_status, 'cancelled'::sale_status) then
    if not public.is_owner() then
      raise exception 'sales_orders.status is terminal; only owner can change it (was: %, attempted: %)',
        old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_orders_block_terminal_status_revert on public.sales_orders;
create trigger trg_sales_orders_block_terminal_status_revert
before update of status on public.sales_orders
for each row execute function public.sales_orders_block_terminal_status_revert();

-- ---------- garage_jobs.status (text column; also constrain set) ------------
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'garage_jobs' and c.conname = 'garage_jobs_status_in_enum'
  ) then
    alter table public.garage_jobs
      add constraint garage_jobs_status_in_enum
      check (status in ('pending','in_progress','waiting_parts','done','cancelled')) not valid;
    alter table public.garage_jobs validate constraint garage_jobs_status_in_enum;
  end if;
end$$;

create or replace function public.garage_jobs_block_terminal_status_revert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('done','cancelled') then
    if not public.is_owner() then
      raise exception 'garage_jobs.status is terminal; only owner can change it (was: %, attempted: %)',
        old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_garage_jobs_block_terminal_status_revert on public.garage_jobs;
create trigger trg_garage_jobs_block_terminal_status_revert
before update of status on public.garage_jobs
for each row execute function public.garage_jobs_block_terminal_status_revert();

comment on function public.cars_block_terminal_status_revert         is 'Blocks reverting cars.status from delivered/scrapped (owner override).';
comment on function public.sales_orders_block_terminal_status_revert is 'Blocks reverting sales_orders.status from delivered/cancelled (owner override).';
comment on function public.garage_jobs_block_terminal_status_revert  is 'Blocks reverting garage_jobs.status from done/cancelled (owner override).';
