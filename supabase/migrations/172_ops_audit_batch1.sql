-- ============================================
-- Monza S.A.L. — Operational audit Batch 1 (2026-06-11)
-- 0a) garage_jobs: allow done→delivered (UI offers it; DB blocked it twice:
--     CHECK constraint lacked 'delivered' AND terminal trigger blocked exits).
-- 0b) sales_orders delivered → cars.status='delivered' (complete_delivery
--     logged a car_event claiming this but never updated the car).
-- 1c) Idempotently seed notification rules that workflows emit but that had
--     no router rows (approvals + outcomes were silent).
-- 1d) Re-enable the paused detect-overdue-test-drives cron (paused in 153
--     while test_drives was empty; module is live now).
-- 1e) Exempt status-change audit rows from the 90-day system_events purge.
-- All idempotent.
-- ============================================

-- 0a. Status enum + terminal-trigger whitelist
alter table public.garage_jobs drop constraint if exists garage_jobs_status_in_enum;
alter table public.garage_jobs add constraint garage_jobs_status_in_enum
  check (status in ('pending','in_progress','waiting_parts','done','cancelled','delivered')) not valid;
alter table public.garage_jobs validate constraint garage_jobs_status_in_enum;

create or replace function public.garage_jobs_block_terminal_status_revert()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  -- done→delivered is the normal handover step; allowed for everyone.
  if old.status = 'done' and new.status = 'delivered' then return new; end if;
  if old.status in ('done','cancelled','delivered') then
    if not public.is_owner() then
      raise exception 'garage_jobs.status is terminal; only owner can change it (was: %, attempted: %)',
        old.status, new.status;
    end if;
  end if;
  return new;
end; $$;

-- 0b. Delivered order syncs the car (forward-only; never reverts).
create or replace function public.sales_orders_sync_car_delivered()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.car_id is not null then
    update public.cars set status = 'delivered', status_changed_at = now()
    where id = new.car_id and status is distinct from 'delivered';
  end if;
  return new;
end; $$;
drop trigger if exists trg_sales_orders_sync_car_delivered on public.sales_orders;
create trigger trg_sales_orders_sync_car_delivered
after update of status on public.sales_orders
for each row execute function public.sales_orders_sync_car_delivered();

-- 1c. Seed missing notification rules (no-op where a rule already exists).
do $$
declare r record;
begin
  for r in select * from (values
    ('refund.needs_owner_approval',   'approval','urgent', 'role','owner'),
    ('refund.needs_manager_approval', 'approval','warning','capability','manage_team'),
    ('refund.approved',  'approval','info','event_submitter',null),
    ('refund.rejected',  'approval','warning','event_submitter',null),
    ('refund.paid',      'approval','info','event_submitter',null),
    ('repair_proposal.needs_owner_approval','approval','urgent','role','owner'),
    ('purchase_order.rejected',        'approval','warning','event_submitter',null),
    ('purchase_order.received_full',   'status_change','info','capability','inventory'),
    ('purchase_order.received_partial','status_change','info','capability','inventory'),
    ('purchase_order.invoice_attached','status_change','info','capability','inventory'),
    ('trade_in.committed','status_change','info','event_submitter',null)
  ) as v(event_type, category, severity, recipient_kind, recipient_value)
  loop
    if not exists (select 1 from public.notification_event_rules n
                   where n.event_type = r.event_type) then
      insert into public.notification_event_rules
        (event_type, description, category, severity, recipient_kind, recipient_value,
         channel_inapp, channel_email, channel_whatsapp, active)
      values (r.event_type, 'Audit batch-1 seeded rule: '||r.event_type,
              r.category::notification_category, r.severity::notification_severity,
              r.recipient_kind, r.recipient_value,
              true, false, false, true);
    end if;
  end loop;
end $$;

-- 1d. Re-enable the test-drive overdue cron.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'detect-overdue-test-drives') then
    perform cron.alter_job(
      job_id := (select jobid from cron.job where jobname = 'detect-overdue-test-drives'),
      active := true);
  end if;
end $$;

-- 1e. Keep status-change audit rows out of the 90-day purge.
create or replace function public.purge_old_system_events()
returns integer language plpgsql security definer
set search_path to 'public', 'pg_temp' as $fn$
declare v_deleted int;
begin
  with d as (
    delete from public.system_events
     where created_at < now() - interval '90 days'
       and event_type not like '%.emitted'
       and event_type not like '%status_change%'
    returning 1
  ) select count(*) from d into v_deleted;
  return v_deleted;
end; $fn$;
