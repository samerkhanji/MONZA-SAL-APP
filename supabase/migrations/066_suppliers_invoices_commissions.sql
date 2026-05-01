-- 066: Suppliers, invoices, commissions.
-- Adds FK column parts.supplier_id (nullable) and cars.supplier_id (nullable)
-- so existing rows are unaffected.

-- =========================================================================
-- suppliers
-- =========================================================================
create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'other'
                    check (kind in ('parts','vehicles','services','other')),
  contact_person  text,
  email           text,
  phone           text,
  address         text,
  notes           text,
  deleted_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name, kind)
);

create index if not exists idx_suppliers_kind on public.suppliers(kind) where deleted_at is null;
create index if not exists idx_suppliers_name on public.suppliers(name) where deleted_at is null;

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated using (true);

drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (
    public.is_owner()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.capabilities && array['inventory'::user_capability,'garage'::user_capability])
  );

drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update on public.suppliers
  for update to authenticated using (
    public.is_owner()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.capabilities && array['inventory'::user_capability,'garage'::user_capability])
  );

drop policy if exists suppliers_delete_owner on public.suppliers;
create policy suppliers_delete_owner on public.suppliers
  for delete to authenticated using (public.is_owner());

comment on table public.suppliers is 'Vendors: parts suppliers, car shippers, service providers.';

-- ---- Link parts and cars to suppliers (nullable FKs) ----------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='parts' and column_name='supplier_id'
  ) then
    alter table public.parts add column supplier_id uuid references public.suppliers(id) on delete set null;
    create index idx_parts_supplier_id on public.parts(supplier_id) where supplier_id is not null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='cars' and column_name='supplier_id'
  ) then
    alter table public.cars add column supplier_id uuid references public.suppliers(id) on delete set null;
    create index idx_cars_supplier_id on public.cars(supplier_id) where supplier_id is not null;
  end if;
end$$;

-- =========================================================================
-- invoices
-- =========================================================================
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique,
  sales_order_id   uuid references public.sales_orders(id) on delete set null,
  customer_id      uuid not null references public.customers(id) on delete restrict,
  issued_at        timestamptz not null default now(),
  due_at           timestamptz,
  total_amount     numeric not null check (total_amount >= 0),
  paid_amount      numeric not null default 0 check (paid_amount >= 0),
  currency         text not null default 'USD',
  status           text not null default 'draft'
                     check (status in ('draft','sent','paid','overdue','cancelled')),
  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (paid_amount <= total_amount)
);

create index if not exists idx_invoices_sales_order on public.invoices(sales_order_id) where sales_order_id is not null;
create index if not exists idx_invoices_customer    on public.invoices(customer_id);
create index if not exists idx_invoices_status      on public.invoices(status);
create index if not exists idx_invoices_due_at      on public.invoices(due_at) where due_at is not null;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated using (true);

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated with check (
    public.is_owner()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.capabilities && array['sales'::user_capability,'cashier'::user_capability])
  );

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated using (
    public.is_owner()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.capabilities && array['sales'::user_capability,'cashier'::user_capability])
  );

drop policy if exists invoices_delete_owner on public.invoices;
create policy invoices_delete_owner on public.invoices
  for delete to authenticated using (public.is_owner());

comment on table public.invoices is 'Customer invoices. Separate from sales_orders so accounting can reconcile.';

-- =========================================================================
-- commissions
-- =========================================================================
create table if not exists public.commissions (
  id                     uuid primary key default gen_random_uuid(),
  sales_order_id         uuid not null references public.sales_orders(id) on delete cascade,
  beneficiary_profile_id uuid not null references public.profiles(id) on delete restrict,
  amount                 numeric not null check (amount >= 0),
  currency               text not null default 'USD',
  status                 text not null default 'pending'
                           check (status in ('pending','approved','paid','cancelled')),
  approved_at            timestamptz,
  paid_at                timestamptz,
  notes                  text,
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (sales_order_id, beneficiary_profile_id)
);

create index if not exists idx_commissions_beneficiary on public.commissions(beneficiary_profile_id);
create index if not exists idx_commissions_status      on public.commissions(status);

drop trigger if exists trg_commissions_updated_at on public.commissions;
create trigger trg_commissions_updated_at before update on public.commissions
for each row execute function public.set_updated_at();

alter table public.commissions enable row level security;

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions
  for select to authenticated using (
    public.is_owner()
    or beneficiary_profile_id = auth.uid()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.capabilities && array['view_reports'::user_capability,'cashier'::user_capability])
  );

drop policy if exists commissions_insert_owner on public.commissions;
create policy commissions_insert_owner on public.commissions
  for insert to authenticated with check (public.is_owner());

drop policy if exists commissions_update_owner on public.commissions;
create policy commissions_update_owner on public.commissions
  for update to authenticated using (public.is_owner());

drop policy if exists commissions_delete_owner on public.commissions;
create policy commissions_delete_owner on public.commissions
  for delete to authenticated using (public.is_owner());

comment on table public.commissions is 'Sales commission records. Owner-managed; beneficiary can view their own.';
