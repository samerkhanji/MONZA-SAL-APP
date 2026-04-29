-- 067: Notification + system_events audit triggers
--   1. parts low-stock crossing -> notifications for users with garage capability
--   2. cars/sales_orders/garage_jobs status change -> system_events row
--   3. notify_expiring_warranties() function (cron-callable) writes alerts
--      via warranty_notifications_sent dedup.

-- ---------- 1) parts low-stock crossing -------------------------------------
create or replace function public.parts_notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_part_label text;
begin
  if not (old.quantity > old.min_quantity and new.quantity <= new.min_quantity) then
    return new;
  end if;

  v_part_label := coalesce(new.part_name, '(unnamed part)');

  insert into public.notifications (user_id, title, message, link, metadata)
  select
    p.id,
    'Part low stock: ' || v_part_label,
    'Part "' || v_part_label || '" is at ' || new.quantity::text
      || ' units (min: ' || new.min_quantity::text || ').',
    '/garage/inventory',
    jsonb_build_object(
      'kind', 'parts_low_stock',
      'part_id', new.id,
      'quantity', new.quantity,
      'min_quantity', new.min_quantity
    )
  from public.profiles p
  where p.capabilities && array['garage'::user_capability,'inventory'::user_capability]
    and p.employment_status is distinct from 'terminated';

  return new;
end;
$$;

drop trigger if exists trg_parts_notify_low_stock on public.parts;
create trigger trg_parts_notify_low_stock
after update of quantity, min_quantity on public.parts
for each row execute function public.parts_notify_low_stock();

-- ---------- 2) status-change audit to system_events -------------------------
create or replace function public.log_status_change_to_system_events()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  insert into public.system_events (event_type, severity, message, metadata)
  values (
    tg_table_name || '.status_changed',
    'info',
    tg_table_name || ' ' || new.id::text || ' status: ' || coalesce(old.status::text,'(null)')
      || ' -> ' || coalesce(new.status::text,'(null)'),
    jsonb_build_object(
      'table', tg_table_name,
      'row_id', new.id,
      'from', old.status,
      'to', new.status,
      'actor', auth.uid()
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_cars_log_status_change on public.cars;
create trigger trg_cars_log_status_change
after update of status on public.cars
for each row execute function public.log_status_change_to_system_events();

drop trigger if exists trg_sales_orders_log_status_change on public.sales_orders;
create trigger trg_sales_orders_log_status_change
after update of status on public.sales_orders
for each row execute function public.log_status_change_to_system_events();

drop trigger if exists trg_garage_jobs_log_status_change on public.garage_jobs;
create trigger trg_garage_jobs_log_status_change
after update of status on public.garage_jobs
for each row execute function public.log_status_change_to_system_events();

-- ---------- 3) warranty expiry alerts (cron-callable) -----------------------
create or replace function public.notify_expiring_warranties(p_threshold_days int default 30)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count int := 0;
  rec record;
begin
  if p_threshold_days <= 0 then
    raise exception 'p_threshold_days must be > 0';
  end if;

  -- vehicle warranty
  for rec in
    select cw.car_id, cw.warranty_vehicle_expiry as expiry, c.vin, c.brand, c.model, 'vehicle' as wkind
    from public.car_warranties cw
    join public.cars c on c.id = cw.car_id
    where cw.warranty_vehicle_expiry is not null
      and cw.warranty_vehicle_expiry <= current_date + (p_threshold_days::text || ' days')::interval
      and cw.warranty_vehicle_expiry >= current_date
      and c.deleted_at is null
      and not exists (
        select 1 from public.warranty_notifications_sent w
        where w.car_id = cw.car_id
          and w.warranty_type = 'vehicle'
          and w.threshold_days = p_threshold_days
      )
  loop
    insert into public.notifications (user_id, title, message, link, metadata)
    select p.id,
           'Vehicle warranty expiring: ' || rec.vin,
           coalesce(rec.brand,'') || ' ' || coalesce(rec.model,'') || ' (' || rec.vin
             || ') vehicle warranty expires on ' || to_char(rec.expiry,'YYYY-MM-DD') || '.',
           '/cars/' || rec.car_id::text,
           jsonb_build_object('kind','warranty_expiring','warranty_type','vehicle','car_id',rec.car_id,'expiry',rec.expiry)
    from public.profiles p
    where p.capabilities && array['garage'::user_capability,'sales'::user_capability]
      and p.employment_status is distinct from 'terminated';

    insert into public.warranty_notifications_sent (car_id, warranty_type, threshold_days)
    values (rec.car_id, 'vehicle', p_threshold_days);
    v_count := v_count + 1;
  end loop;

  -- battery warranty
  for rec in
    select cw.car_id, cw.warranty_battery_expiry as expiry, c.vin, c.brand, c.model, 'battery' as wkind
    from public.car_warranties cw
    join public.cars c on c.id = cw.car_id
    where cw.warranty_battery_expiry is not null
      and cw.warranty_battery_expiry <= current_date + (p_threshold_days::text || ' days')::interval
      and cw.warranty_battery_expiry >= current_date
      and c.deleted_at is null
      and not exists (
        select 1 from public.warranty_notifications_sent w
        where w.car_id = cw.car_id
          and w.warranty_type = 'battery'
          and w.threshold_days = p_threshold_days
      )
  loop
    insert into public.notifications (user_id, title, message, link, metadata)
    select p.id,
           'Battery warranty expiring: ' || rec.vin,
           coalesce(rec.brand,'') || ' ' || coalesce(rec.model,'') || ' (' || rec.vin
             || ') battery warranty expires on ' || to_char(rec.expiry,'YYYY-MM-DD') || '.',
           '/cars/' || rec.car_id::text,
           jsonb_build_object('kind','warranty_expiring','warranty_type','battery','car_id',rec.car_id,'expiry',rec.expiry)
    from public.profiles p
    where p.capabilities && array['garage'::user_capability,'sales'::user_capability]
      and p.employment_status is distinct from 'terminated';

    insert into public.warranty_notifications_sent (car_id, warranty_type, threshold_days)
    values (rec.car_id, 'battery', p_threshold_days);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.notify_expiring_warranties(int) from public, authenticated;
grant  execute on function public.notify_expiring_warranties(int) to service_role;

comment on function public.parts_notify_low_stock              is 'Fans out a notification to garage/inventory users when parts.quantity crosses min_quantity downward.';
comment on function public.log_status_change_to_system_events  is 'Generic status-change auditor; insert into system_events for cars/sales_orders/garage_jobs.';
comment on function public.notify_expiring_warranties          is 'Cron-callable: emits warranty-expiring notifications, deduped via warranty_notifications_sent.';
