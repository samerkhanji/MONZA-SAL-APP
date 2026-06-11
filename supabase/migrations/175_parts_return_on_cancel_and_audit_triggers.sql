-- ============================================
-- Monza S.A.L. — Operational audit Batch 3a (2026-06-11)
-- Inventory integrity + accountability gaps from the audit:
--  1) Cancelling a garage job orphaned its parts (stock decremented, never
--     returned). Auto-return them on cancel.
--  2) Role/capability changes and approval-threshold edits left NO audit
--     trail. Add triggers that log them to system_events with the actor.
--  3) Keep those audit rows out of the 90-day purge.
-- All idempotent.
-- ============================================

-- 1) Return a cancelled job's parts to stock (mirrors return_part_from_job).
create or replace function public.garage_jobs_return_parts_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  jp record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for jp in select * from public.job_parts where job_id = new.id loop
      update public.parts
         set quantity = quantity + jp.quantity, updated_at = now()
       where id = jp.part_id;
      insert into public.part_movements
        (part_id, movement_type, quantity, car_id, job_description, note, created_by)
      values
        (jp.part_id, 'return', jp.quantity, new.car_id,
         'Auto-return on job cancel ' || new.id::text, 'Job cancelled', auth.uid());
      delete from public.job_parts where id = jp.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_garage_jobs_return_parts_on_cancel on public.garage_jobs;
create trigger trg_garage_jobs_return_parts_on_cancel
after update of status on public.garage_jobs
for each row execute function public.garage_jobs_return_parts_on_cancel();

-- 2a) Audit profile privilege changes (role / capabilities / active flag).
create or replace function public.audit_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (new.user_role is distinct from old.user_role)
     or (new.capabilities is distinct from old.capabilities)
     or (new.is_active is distinct from old.is_active) then
    insert into public.system_events (event_type, severity, message, metadata)
    values (
      'profile.privilege_changed', 'warning',
      'Profile privileges changed for ' || coalesce(new.full_name, new.id::text),
      jsonb_build_object(
        'actor', auth.uid(),
        'target', new.id,
        'old_role', old.user_role, 'new_role', new.user_role,
        'old_capabilities', old.capabilities, 'new_capabilities', new.capabilities,
        'old_is_active', old.is_active, 'new_is_active', new.is_active
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_profile_privilege_change on public.profiles;
create trigger trg_audit_profile_privilege_change
after update on public.profiles
for each row execute function public.audit_profile_privilege_change();

-- 2b) Audit approval-threshold edits.
create or replace function public.audit_approval_threshold_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.system_events (event_type, severity, message, metadata)
  values (
    'approval_threshold.changed', 'warning',
    'Approval threshold ' || new.id || ' edited',
    jsonb_build_object(
      'actor', auth.uid(),
      'threshold', new.id,
      'old', to_jsonb(old),
      'new', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_approval_threshold_change on public.approval_thresholds;
create trigger trg_audit_approval_threshold_change
after update on public.approval_thresholds
for each row execute function public.audit_approval_threshold_change();

-- 3) Retain these audit rows past the 90-day system_events purge.
create or replace function public.purge_old_system_events()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_deleted int;
begin
  with d as (
    delete from public.system_events
     where created_at < now() - interval '90 days'
       and event_type not like '%.emitted'
       and event_type not like '%status_change%'
       and event_type not like 'profile.%'
       and event_type not like 'approval_threshold.%'
    returning 1
  ) select count(*) from d into v_deleted;
  return v_deleted;
end;
$fn$;
