-- 064: Capability guards on destructive SECURITY DEFINER RPCs
--
-- Each destructive function now (a) requires authentication, (b) checks the
-- caller's capability/role, and (c) ignores the spoofable p_user_id arg in
-- favor of auth.uid() for written audit columns. Behavior otherwise preserved.
--
-- Also drops receive_shipped_car_by_vin: it references shipping_eta_entries /
-- shipping_eta_events tables that no longer exist in this DB. Dead RPC.

-- ---- Helper: require_any_capability ---------------------------------------
create or replace function public._require_any_capability(p_caps user_capability[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_caps user_capability[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if public.is_owner() then
    return;
  end if;
  select capabilities into v_caps from public.profiles where id = v_uid;
  if v_caps is null or not (v_caps && p_caps) then
    raise exception 'Forbidden: requires capability % (caller has %)',
      p_caps, coalesce(v_caps, '{}'::user_capability[])
      using errcode = '42501';
  end if;
end;
$$;

comment on function public._require_any_capability is 'Internal guard: raises unless caller is owner or has any of the listed capabilities.';

-- =========================================================================
-- apply_part_to_job (garage)
-- =========================================================================
create or replace function public.apply_part_to_job(
  p_job_id   uuid,
  p_part_id  uuid,
  p_quantity integer,
  p_note     text default null,
  p_user_id  uuid default auth.uid()
)
returns job_parts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_part     public.parts;
  v_job_part public.job_parts;
  v_car_id   uuid;
  v_actor    uuid;
begin
  perform public._require_any_capability(array['garage'::user_capability]);
  v_actor := auth.uid();

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be > 0' using errcode = '22023';
  end if;

  select * into v_part from public.parts where id = p_part_id and deleted_at is null for update;
  if not found then
    raise exception 'Part % not found or deleted', p_part_id using errcode = '02000';
  end if;
  if v_part.quantity < p_quantity then
    raise exception 'Insufficient stock (have %, need %)', v_part.quantity, p_quantity using errcode = '22023';
  end if;

  select car_id into v_car_id from public.garage_jobs where id = p_job_id;
  if not found then
    raise exception 'Job % not found', p_job_id using errcode = '02000';
  end if;

  update public.parts
     set quantity = quantity - p_quantity, updated_at = now()
   where id = p_part_id;

  insert into public.part_movements (
    part_id, movement_type, quantity, car_id, job_description, note, created_by
  ) values (
    p_part_id, 'stock_out', p_quantity, v_car_id,
    'Used on job ' || p_job_id::text, p_note, v_actor
  );

  insert into public.job_parts (
    job_id, part_id, quantity, note, created_by,
    unit_cost_snapshot, currency_snapshot, used_at
  ) values (
    p_job_id, p_part_id, p_quantity, p_note, v_actor,
    v_part.unit_cost, v_part.currency, now()
  )
  returning * into v_job_part;

  return v_job_part;
end;
$$;

-- =========================================================================
-- return_part_from_job (garage)
-- =========================================================================
create or replace function public.return_part_from_job(
  p_job_part_id uuid,
  p_user_id     uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_jp     public.job_parts;
  v_car_id uuid;
  v_actor  uuid;
begin
  perform public._require_any_capability(array['garage'::user_capability]);
  v_actor := auth.uid();

  select * into v_jp from public.job_parts where id = p_job_part_id;
  if not found then
    raise exception 'job_parts row % not found', p_job_part_id using errcode = '02000';
  end if;

  select car_id into v_car_id from public.garage_jobs where id = v_jp.job_id;

  update public.parts
     set quantity = quantity + v_jp.quantity, updated_at = now()
   where id = v_jp.part_id;

  insert into public.part_movements (
    part_id, movement_type, quantity, car_id, job_description, note, created_by
  ) values (
    v_jp.part_id, 'return', v_jp.quantity, v_car_id,
    'Returned from job ' || v_jp.job_id::text, 'Reverted apply', v_actor
  );

  delete from public.job_parts where id = p_job_part_id;
  return true;
end;
$$;

-- =========================================================================
-- attach_job_to_bay (garage)
-- =========================================================================
create or replace function public.attach_job_to_bay(
  p_job_id  uuid,
  p_bay_id  integer,
  p_user_id uuid default auth.uid()
)
returns garage_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job   public.garage_jobs;
  v_bay   public.garage_bays;
  v_vin   text;
  v_actor uuid;
begin
  perform public._require_any_capability(array['garage'::user_capability]);
  v_actor := auth.uid();

  select * into v_bay from public.garage_bays where id = p_bay_id for update;
  if not found then
    raise exception 'Bay % not found', p_bay_id using errcode = '02000';
  end if;
  if v_bay.is_active = false then
    raise exception 'Bay % is inactive', p_bay_id using errcode = '23P01';
  end if;
  if v_bay.current_job_id is not null then
    raise exception 'Bay % already occupied by job %', p_bay_id, v_bay.current_job_id using errcode = '23P01';
  end if;

  select * into v_job from public.garage_jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job % not found', p_job_id using errcode = '02000';
  end if;
  if v_job.garage_bay_id is not null and v_job.garage_bay_id <> p_bay_id then
    raise exception 'Job % is already on bay %', p_job_id, v_job.garage_bay_id using errcode = '23P01';
  end if;

  if v_bay.bay_type = 'battery_lab' and coalesce(v_job.is_battery_only, false) = false then
    raise exception 'Battery Lab bays accept battery-only jobs' using errcode = '23P01';
  end if;
  if v_bay.bay_type <> 'battery_lab' and coalesce(v_job.is_battery_only, false) = true then
    raise exception 'Battery-only jobs go to a Battery Lab bay' using errcode = '23P01';
  end if;

  update public.garage_jobs
     set garage_bay_id  = p_bay_id,
         bay_entered_at = now(),
         status         = case when status = 'pending' then 'in_progress' else status end,
         started_at     = coalesce(started_at, now()),
         assigned_to    = coalesce(assigned_to, v_actor),
         updated_at     = now()
   where id = p_job_id
   returning * into v_job;

  update public.garage_bays
     set current_job_id = v_job.id, status = 'occupied', updated_at = now()
   where id = p_bay_id;

  select vin into v_vin from public.cars where id = v_job.car_id;
  insert into public.bay_assignment_history (
    bay_id, job_id, car_id, vin, event_type,
    bay_status_before, bay_status_after, created_by
  ) values (
    p_bay_id, v_job.id, v_job.car_id, v_vin, 'entered',
    v_bay.status, 'occupied', v_actor
  );

  return v_job;
end;
$$;

-- =========================================================================
-- scan_vin_to_bay (garage)
-- =========================================================================
create or replace function public.scan_vin_to_bay(
  p_vin     text,
  p_bay_id  integer,
  p_user_id uuid default auth.uid()
)
returns garage_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_car   public.cars;
  v_bay   public.garage_bays;
  v_job   public.garage_jobs;
  v_actor uuid;
begin
  perform public._require_any_capability(array['garage'::user_capability]);
  v_actor := auth.uid();

  select * into v_car from public.cars where vin = p_vin and deleted_at is null limit 1;
  if not found then
    raise exception 'No car found with VIN %', p_vin using errcode = '02000';
  end if;

  select * into v_bay from public.garage_bays where id = p_bay_id for update;
  if not found then
    raise exception 'Bay % not found', p_bay_id using errcode = '02000';
  end if;
  if v_bay.is_active = false then
    raise exception 'Bay % is inactive', p_bay_id using errcode = '23P01';
  end if;
  if v_bay.current_job_id is not null then
    raise exception 'Bay % already occupied by job %', p_bay_id, v_bay.current_job_id using errcode = '23P01';
  end if;

  select * into v_job from public.garage_jobs
   where car_id = v_car.id and deleted_at is null
     and status in ('pending','in_progress','waiting_parts')
     and (garage_bay_id is null or garage_bay_id = p_bay_id)
   order by created_at desc
   limit 1;

  if not found then
    insert into public.garage_jobs (
      car_id, customer_id, status, started_at,
      garage_bay_id, bay_entered_at, created_by, assigned_to,
      title, complaint, priority
    ) values (
      v_car.id, v_car.customer_id, 'in_progress', now(),
      p_bay_id, now(), v_actor, v_actor,
      'Service - ' || coalesce(v_car.brand,'') || ' ' || coalesce(v_car.model,''),
      'Walk-in scan',
      'normal'
    )
    returning * into v_job;
  else
    update public.garage_jobs
       set garage_bay_id  = p_bay_id,
           bay_entered_at = now(),
           status         = case when status = 'pending' then 'in_progress' else status end,
           started_at     = coalesce(started_at, now()),
           assigned_to    = coalesce(assigned_to, v_actor),
           updated_at     = now()
     where id = v_job.id
     returning * into v_job;
  end if;

  update public.garage_bays
     set current_job_id = v_job.id, status = 'occupied', updated_at = now()
   where id = p_bay_id;

  insert into public.bay_assignment_history (
    bay_id, job_id, car_id, vin, event_type,
    bay_status_before, bay_status_after, created_by
  ) values (
    p_bay_id, v_job.id, v_car.id, p_vin, 'entered',
    v_bay.status, 'occupied', v_actor
  );

  return v_job;
end;
$$;

-- =========================================================================
-- release_bay (garage)
-- =========================================================================
create or replace function public.release_bay(
  p_bay_id          integer,
  p_user_id         uuid default auth.uid(),
  p_new_job_status  text default null,
  p_set_bay_status  text default 'empty'
)
returns garage_bays
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_bay   public.garage_bays;
  v_job   public.garage_jobs;
  v_vin   text;
  v_actor uuid;
begin
  perform public._require_any_capability(array['garage'::user_capability]);
  v_actor := auth.uid();

  if p_set_bay_status not in ('empty','cleaning','maintenance') then
    raise exception 'Invalid bay status %', p_set_bay_status using errcode = '22023';
  end if;

  select * into v_bay from public.garage_bays where id = p_bay_id for update;
  if not found then
    raise exception 'Bay % not found', p_bay_id using errcode = '02000';
  end if;

  if v_bay.current_job_id is not null then
    select * into v_job from public.garage_jobs where id = v_bay.current_job_id;
    select vin into v_vin from public.cars where id = v_job.car_id;

    update public.garage_jobs
       set garage_bay_id = null,
           bay_exited_at = now(),
           status        = coalesce(nullif(p_new_job_status,''), status),
           completed_at  = case
             when coalesce(nullif(p_new_job_status,''), status) in ('done','delivered','cancelled')
                  then now() else completed_at end,
           updated_at    = now()
     where id = v_bay.current_job_id;

    insert into public.bay_assignment_history (
      bay_id, job_id, car_id, vin, event_type,
      bay_status_before, bay_status_after, created_by
    ) values (
      p_bay_id, v_job.id, v_job.car_id, v_vin, 'exited',
      v_bay.status, p_set_bay_status, v_actor
    );
  end if;

  update public.garage_bays
     set current_job_id = null, status = p_set_bay_status, updated_at = now()
   where id = p_bay_id
   returning * into v_bay;

  return v_bay;
end;
$$;

-- =========================================================================
-- complete_delivery (sales)
-- =========================================================================
create or replace function public.complete_delivery(
  p_sales_order_id uuid,
  p_notes          text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
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
$$;

-- =========================================================================
-- Drop dead RPC (references missing shipping tables)
-- =========================================================================
drop function if exists public.receive_shipped_car_by_vin(text, location_type, text, uuid);

-- =========================================================================
-- create_car / move_car: capability gate (auth.uid() already enforced in 062)
-- =========================================================================
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
  p_user_id         uuid          default null
)
returns cars
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_car   public.cars;
  v_actor uuid;
begin
  perform public._require_any_capability(array['inventory'::user_capability]);
  v_actor := auth.uid();

  insert into public.cars (
    vin, brand, model, model_year, exterior_color, interior_color,
    location_type, location_slot, status, created_by
  ) values (
    p_vin, p_brand, p_model, p_model_year, p_exterior_color, p_interior_color,
    p_location_type, p_location_slot, p_status, v_actor
  )
  returning * into v_car;

  return v_car;
end;
$$;

create or replace function public.move_car(
  p_car_id            uuid,
  p_new_location_type location_type,
  p_new_location_slot text,
  p_new_status        car_status default null,
  p_note              text default null,
  p_user_id           uuid default null
)
returns cars
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_car  public.cars;
begin
  perform public._require_any_capability(array[
    'inventory'::user_capability,
    'garage'::user_capability,
    'sales'::user_capability
  ]);

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

comment on function public.move_car             is 'Moves a car. Requires inventory|garage|sales capability or owner. p_user_id is ignored.';
comment on function public.create_car           is 'Creates a car. Requires inventory capability or owner. p_user_id is ignored.';
comment on function public.complete_delivery    is 'Completes a sales delivery. Requires sales capability or owner.';
comment on function public.apply_part_to_job    is 'Applies a part to a job. Requires garage capability or owner.';
comment on function public.return_part_from_job is 'Returns a part from a job. Requires garage capability or owner.';
comment on function public.attach_job_to_bay    is 'Attaches a job to a bay. Requires garage capability or owner.';
comment on function public.scan_vin_to_bay      is 'Scans a VIN onto a bay. Requires garage capability or owner.';
comment on function public.release_bay          is 'Releases a bay. Requires garage capability or owner.';
