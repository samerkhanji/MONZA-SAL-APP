-- 065: Add tasks, customer_interactions, appointments domains.
-- Resurrects the broken complete_task / create_task_from_request RPCs that
-- referenced public.tasks (which never existed).

-- =========================================================================
-- tasks
-- =========================================================================
create table if not exists public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  status              text not null default 'open'
                        check (status in ('open','in_progress','blocked','done','cancelled')),
  priority            job_priority not null default 'normal',
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  department_id       uuid,
  source_type         text,
  source_id           uuid,
  due_at              timestamptz,
  completed_at        timestamptz,
  created_by_user_id  uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to_user_id) where assigned_to_user_id is not null;
create index if not exists idx_tasks_status      on public.tasks(status);
create index if not exists idx_tasks_due_at      on public.tasks(due_at) where due_at is not null;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists tasks_select_authenticated on public.tasks;
create policy tasks_select_authenticated on public.tasks
  for select to authenticated using (true);

drop policy if exists tasks_insert_authenticated on public.tasks;
create policy tasks_insert_authenticated on public.tasks
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists tasks_update_assignee_or_creator on public.tasks;
create policy tasks_update_assignee_or_creator on public.tasks
  for update to authenticated using (
    public.is_owner()
    or assigned_to_user_id = auth.uid()
    or created_by_user_id  = auth.uid()
  );

drop policy if exists tasks_delete_owner on public.tasks;
create policy tasks_delete_owner on public.tasks
  for delete to authenticated using (public.is_owner());

comment on table public.tasks is 'General-purpose tasks across the org (cross-domain). Use garage_tasks for garage-specific.';

-- =========================================================================
-- customer_interactions
-- =========================================================================
create table if not exists public.customer_interactions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  car_id        uuid references public.cars(id) on delete set null,
  channel       text not null check (channel in ('phone','whatsapp','email','sms','in_person','website','instagram','facebook','other')),
  direction     text not null check (direction in ('inbound','outbound')),
  subject       text,
  body          text,
  occurred_at   timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_customer_interactions_customer on public.customer_interactions(customer_id);
create index if not exists idx_customer_interactions_car      on public.customer_interactions(car_id) where car_id is not null;
create index if not exists idx_customer_interactions_occurred on public.customer_interactions(occurred_at desc);

drop trigger if exists trg_customer_interactions_updated_at on public.customer_interactions;
create trigger trg_customer_interactions_updated_at before update on public.customer_interactions
for each row execute function public.set_updated_at();

alter table public.customer_interactions enable row level security;

drop policy if exists customer_interactions_select on public.customer_interactions;
create policy customer_interactions_select on public.customer_interactions
  for select to authenticated using (true);

drop policy if exists customer_interactions_insert on public.customer_interactions;
create policy customer_interactions_insert on public.customer_interactions
  for insert to authenticated with check (
    public.is_owner()
    or auth.uid() is not null and (
      exists (select 1 from public.profiles p
              where p.id = auth.uid()
                and p.capabilities && array['sales'::user_capability,'garage'::user_capability])
    )
  );

drop policy if exists customer_interactions_update_creator on public.customer_interactions;
create policy customer_interactions_update_creator on public.customer_interactions
  for update to authenticated using (public.is_owner() or created_by = auth.uid());

drop policy if exists customer_interactions_delete_owner on public.customer_interactions;
create policy customer_interactions_delete_owner on public.customer_interactions
  for delete to authenticated using (public.is_owner());

comment on table public.customer_interactions is 'Communications log: calls, WhatsApp, email, SMS, walk-ins.';

-- =========================================================================
-- appointments
-- =========================================================================
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('test_drive','service','sales_meeting','delivery','followup','other')),
  customer_id       uuid references public.customers(id) on delete set null,
  car_id            uuid references public.cars(id) on delete set null,
  assigned_to       uuid references public.profiles(id) on delete set null,
  scheduled_for     timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes > 0),
  status            text not null default 'scheduled'
                       check (status in ('scheduled','confirmed','in_progress','completed','no_show','cancelled')),
  location          text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_appointments_scheduled_for on public.appointments(scheduled_for);
create index if not exists idx_appointments_assigned_to   on public.appointments(assigned_to) where assigned_to is not null;
create index if not exists idx_appointments_customer      on public.appointments(customer_id) where customer_id is not null;
create index if not exists idx_appointments_car           on public.appointments(car_id) where car_id is not null;
create index if not exists idx_appointments_status        on public.appointments(status);

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated using (true);

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated using (
    public.is_owner() or assigned_to = auth.uid() or created_by = auth.uid()
  );

drop policy if exists appointments_delete_owner on public.appointments;
create policy appointments_delete_owner on public.appointments
  for delete to authenticated using (public.is_owner());

comment on table public.appointments is 'Scheduled events: test drives, service appointments, sales meetings, deliveries, follow-ups.';
