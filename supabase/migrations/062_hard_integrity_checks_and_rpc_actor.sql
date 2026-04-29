-- 062: Hard integrity hardening
--   1. Non-negative CHECKs on price/qty/hours columns (idempotent)
--   2. move_car/create_car always use auth.uid() (p_user_id retained for back-compat but ignored)

-- 1) CHECK constraints --------------------------------------------------------
do $$
declare
  checks text[][] := array[
    ['cars',                  'cars_price_nonneg',                  'price >= 0'],
    ['cars',                  'cars_customs_paid_nonneg',           'customs_amount_paid >= 0'],
    ['sales_orders',          'sales_orders_selling_price_nonneg',  'selling_price >= 0'],
    ['sales_orders',          'sales_orders_deposit_nonneg',        'deposit_amount >= 0'],
    ['sales_orders',          'sales_orders_quote_nonneg',          'quote_amount >= 0'],
    ['parts',                 'parts_unit_cost_nonneg',             'unit_cost >= 0'],
    ['parts',                 'parts_quantity_nonneg',              'quantity >= 0'],
    ['parts',                 'parts_min_quantity_nonneg',          'min_quantity >= 0'],
    ['payment_plans',         'payment_plans_total_nonneg',         'total_amount >= 0'],
    ['payment_plans',         'payment_plans_monthly_nonneg',       'monthly_amount >= 0'],
    ['installment_payments',  'installment_payments_due_nonneg',    'amount_due >= 0'],
    ['installment_payments',  'installment_payments_paid_nonneg',   'paid_amount >= 0'],
    ['job_parts',             'job_parts_quantity_pos',             'quantity > 0'],
    ['job_parts',             'job_parts_unit_cost_nonneg',         'unit_cost_snapshot >= 0'],
    ['repair_proposal_items', 'repair_proposal_items_qty_pos',      'quantity > 0'],
    ['repair_proposal_items', 'repair_proposal_items_unit_nonneg',  'unit_price >= 0'],
    ['repair_proposal_items', 'repair_proposal_items_total_nonneg', 'total_price >= 0'],
    ['garage_jobs',           'garage_jobs_est_hours_nonneg',       'estimated_hours >= 0'],
    ['garage_jobs',           'garage_jobs_actual_hours_nonneg',    'actual_hours >= 0']
  ];
  i int;
begin
  for i in 1 .. array_length(checks, 1) loop
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = checks[i][1] and c.conname = checks[i][2]
    ) then
      execute format('alter table public.%I add constraint %I check (%s) not valid',
        checks[i][1], checks[i][2], checks[i][3]);
      execute format('alter table public.%I validate constraint %I',
        checks[i][1], checks[i][2]);
    end if;
  end loop;
end$$;

-- 2) Harden move_car / create_car: actor is always auth.uid() ---------------
create or replace function public.move_car(
  p_car_id            uuid,
  p_new_location_type location_type,
  p_new_location_slot text,
  p_new_status        car_status default null,
  p_note              text default null,
  p_user_id           uuid default null  -- accepted for back-compat, ignored
)
returns cars
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_car    public.cars;
  v_actor  uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'move_car requires an authenticated user';
  end if;

  update public.cars
  set
    location_type = p_new_location_type,
    location_slot = p_new_location_slot,
    status        = coalesce(p_new_status, status)
  where id = p_car_id
  returning * into v_car;

  if not found then
    raise exception 'Car not found: %', p_car_id;
  end if;

  return v_car;
end;
$$;

create or replace function public.create_car(
  p_vin             text,
  p_brand           text,
  p_model           text,
  p_model_year      integer       default null,
  p_exterior_color  text          default null,
  p_interior_color  text          default null,
  p_location_type   location_type default 'storage'::location_type,
  p_location_slot   text          default null,
  p_status          car_status    default 'inbound'::car_status,
  p_user_id         uuid          default null  -- accepted for back-compat, ignored
)
returns cars
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_car   public.cars;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'create_car requires an authenticated user';
  end if;

  insert into public.cars (
    vin, brand, model, model_year, exterior_color, interior_color,
    location_type, location_slot, status, created_by
  )
  values (
    p_vin, p_brand, p_model, p_model_year, p_exterior_color, p_interior_color,
    p_location_type, p_location_slot, p_status, v_actor
  )
  returning * into v_car;

  return v_car;
end;
$$;

comment on function public.move_car   is 'Moves a car. p_user_id is ignored; actor is always auth.uid().';
comment on function public.create_car is 'Creates a car. p_user_id is ignored; created_by is always auth.uid().';
