# Monza App — Database Schema (Supabase)

> Source of truth for the application's logical data model. Exact DDL lives in `supabase/migrations/`. Last refreshed after migration `068_lockdown_internal_definer_fns`.

---

## Overview

- **Engine**: PostgreSQL 17 (Supabase project `okxpsvukzjjubinhamek`, region eu-central-1)
- **Access**: Supabase REST, Realtime, RPC
- **Auth**: Supabase Auth (`auth.users`) + `public.profiles`
- **Security**: Row-Level Security (RLS) enabled on every application table; capability-based RPC guards via `_require_any_capability()`

High-level domains:

- **Inventory** — `cars`, `cars_display`, `car_events`, `car_warranties`, `car_documents`
- **CRM** — `customers`, `customers_display`, `customer_notes`, `customer_documents`, `customer_interactions`, `requests`
- **Sales** — `sales_orders`, `payment_plans`, `installment_payments`, `test_drives`, `invoices`, `commissions`
- **Garage** — `garage_jobs`, `garage_bays`, `garage_capacities`, `garage_tasks`, `garage_task_templates`, `parts`, `part_movements`, `job_parts`, `job_documents`, `job_time_entries`, `repair_proposals`, `repair_proposal_items`, `bay_assignment_history`, `garage_job_bay_context`, `task_timers`, `accessory_custom_tables`, `accessory_custom_items`
- **Scheduling** — `appointments`, `tasks`
- **Procurement** — `suppliers`
- **Users / Roles** — `profiles` (RBAC: `user_role` + `user_capability[]`)
- **Notifications & Audit** — `notifications`, `system_events`, `push_subscriptions`, `warranty_notifications_sent`, `service_day_notifications_sent`, `delete_requests`, `document_access_requests`, `page_access_requests`
- **System** — `system_preferences`, `infrastructure_compute_target`

---

## Enums

| Enum | Values |
|---|---|
| `car_status` | inbound, in_stock, showroom, reserved, sold, delivered, service, sent_to_sub_dealer, demo, registered, under_registration, sent_to_customs, company_car, inventory, test_drive, available, scrapped |
| `car_event_type` | created, moved, status_changed, battery_updated, pdi_updated, details_updated, note_added |
| `car_document_type` | pdi, job_card |
| `customs_status` | pending, in_progress, cleared, exempt |
| `garage_task_status` | pending, in_progress, blocked, done, cancelled |
| `installment_status` | upcoming, due, overdue, paid, waived |
| `job_priority` | low, normal, urgent |
| `job_status` | pending, in_progress, waiting_parts, done, cancelled |
| `lead_source` | walk_in, phone, whatsapp, instagram, facebook, website, referral, event, other |
| `lead_status` | new_lead, contacted, interested, test_drive, negotiation, converted, lost |
| `location_type` | showroom1, showroom2, garage, storage, inventory |
| `part_status` | in_stock, low_stock, out_of_stock, discontinued |
| `payment_plan_status` | active, completed, defaulted, cancelled |
| `payment_type` | full, installments |
| `pdi_status` | pending, in_progress, done |
| `sale_status` | reserved, draft, confirmed, paid, delivered, cancelled |
| `shipping_status` | pending, in_transit, arrived_port, customs, ready, received |
| `user_role` | owner, sales, garage_manager, assistant, khalil_hybrid, it, garage_staff, sales_ops, hybrid |
| `user_capability` | garage, vehicle_software, cashier, events_ops, manage_team, edit_users, deactivate_users, view_reports, inventory, sales, data_health |

---

## Core tables

### `cars`
Inventory: one row per physical vehicle (VIN unique).

- `vin text unique not null`
- `status car_status` — terminal states `delivered` and `scrapped` (trigger 063)
- `location_type location_type`, `location_slot text`
- `brand`, `model`, `model_year`, `exterior_color`, `interior_color`, `is_erev`, `ev_km`, `motor_km`
- `price numeric`, `price_currency text default 'USD'`, `customs_amount_paid numeric` — all `>= 0` (CHECK constraints, migration 062)
- `supplier_id uuid → suppliers.id` (nullable)
- Audit: `created_at`, `created_by`, `updated_at`, `deleted_at`

### `customers`
Doubles as the leads table (no separate `leads`).
- `first_name`, `last_name`, `phone_primary`, `phone_secondary`, `email`, `company`, `address`, `date_of_birth`, `notes`
- `lead_status lead_status not null`, `lead_source lead_source` — populated by sales pipeline
- Audit fields + `deleted_at`

### `sales_orders`
Connects cars and customers; encodes the sales lifecycle.
- `car_id → cars.id`, `customer_id → customers.id`
- `status sale_status` — terminal states `delivered` and `cancelled` (trigger 063)
- `selling_price`, `deposit_amount`, `quote_amount` — `>= 0` (CHECK constraints)
- `delivered_at`, `delivered_by`, `delivery_notes`
- Trigger `trg_sync_car_status_from_sale` keeps `cars.status` in sync.

### `profiles`
- `id uuid pk` = `auth.users.id`
- `user_role user_role` — single source of truth for high-level role
- `capabilities user_capability[]` — fine-grained gates (used by `_require_any_capability`)
- `email` synced from `auth.users` via trigger
- `employment_status`, `terminated_at`, `termination_reason`
- Self-update + owner-update via RLS; trigger `profiles_block_self_privilege_escalation_trg` blocks privilege climbs.

### `garage_jobs`
- `car_id`, `customer_id`, `garage_bay_id`, `assigned_to`
- `status text` constrained to `job_status` enum set (CHECK, migration 063); terminal `done`/`cancelled`
- `priority job_priority`, `is_battery_only bool`
- `estimated_hours`, `actual_hours` `>= 0` (CHECK)
- Time entries via `job_time_entries` recompute `actual_hours` (trigger).

### `parts`
- `part_name`, `oe_number`, `quantity`, `min_quantity`, `unit_cost`, `currency`
- `supplier_id → suppliers.id` (nullable; migration 066). Legacy `supplier`/`supplier_contact` text columns retained.
- `status part_status` auto-maintained by `update_part_status` trigger.
- Low-stock crossing fans out notifications via `parts_notify_low_stock` trigger (067).

### `tasks` *(added 065)*
General-purpose cross-domain task tracker. Resurrects the `complete_task` and `create_task_from_request` RPCs that referenced this missing table.
- `title`, `description`, `status` (open/in_progress/blocked/done/cancelled)
- `priority job_priority`, `assigned_to_user_id`, `due_at`, `completed_at`
- `(source_type, source_id)` unique — used by `create_task_from_request`

### `customer_interactions` *(added 065)*
Communications log: phone, WhatsApp, email, SMS, in-person, social, website, other.
- `customer_id` (cascade), `car_id` (set null), `direction`, `subject`, `body`, `occurred_at`

### `appointments` *(added 065)*
Scheduled events: test drive, service, sales meeting, delivery, follow-up.
- `kind`, `customer_id`, `car_id`, `assigned_to`, `scheduled_for`, `duration_minutes`, `status`, `location`, `notes`

### `suppliers` *(added 066)*
Vendors: parts / vehicles / services / other.
- `(name, kind)` unique. Linked from `parts.supplier_id` and `cars.supplier_id`.

### `invoices` *(added 066)*
Customer invoices, separate from `sales_orders` so accounting can reconcile.
- `invoice_number unique`, `sales_order_id` (set null), `customer_id` (restrict)
- `total_amount`, `paid_amount`, `currency`, `status` (draft/sent/paid/overdue/cancelled)
- CHECK: `paid_amount <= total_amount`

### `commissions` *(added 066)*
Sales commission records.
- `(sales_order_id, beneficiary_profile_id)` unique
- `amount >= 0`, `currency`, `status` (pending/approved/paid/cancelled), `approved_at`, `paid_at`
- RLS: owner-managed; beneficiary sees their own; `view_reports`/`cashier` capabilities can view.

### Audit & notifications
- `system_events` — generic event log; `cars/sales_orders/garage_jobs` status changes auto-log here (trigger 067).
- `notifications` — per-user inbox; populated by triggers (parts low-stock) and the cron-callable `notify_expiring_warranties()` fn.
- `warranty_notifications_sent` — dedup table for warranty expiry alerts.

---

## RPCs (public API)

### Inventory
- `create_car(...)` — requires `inventory` capability. `created_by = auth.uid()` (062, 064).
- `move_car(...)` — requires `inventory|garage|sales` capability (064).

### Sales
- `complete_delivery(p_sales_order_id, p_notes)` — requires `sales` capability. Updates `sales_orders.status -> delivered`, marks customer `converted`, emits `car_events` row.

### Garage
- `apply_part_to_job(p_job_id, p_part_id, p_quantity, ...)` — requires `garage`. Decrements parts, writes `part_movements` + `job_parts`.
- `return_part_from_job(p_job_part_id)` — reverses an apply.
- `attach_job_to_bay(p_job_id, p_bay_id)` — requires `garage`. Validates battery-lab type matching.
- `scan_vin_to_bay(p_vin, p_bay_id)` — opens or attaches a job for a scanned VIN.
- `release_bay(p_bay_id, p_new_job_status, p_set_bay_status)` — closes a bay.

### RBAC helpers (RLS use)
- `is_owner()`, `is_role(role)`, `is_any_role(role[])`, `has_role(role)`, `has_capability(cap)`, `get_my_user_role()`, `is_pipeline_user()`, `can_view_owner_requests()`.

### Internal / cron
- `_require_any_capability(caps[])` — internal guard, **not** REST-callable (068).
- `notify_expiring_warranties(threshold_days int)` — service-role only (068). Walks `car_warranties`, fans out alerts.

---

## Triggers (selected)

| Table | Trigger | Purpose |
|---|---|---|
| `cars` | `trg_log_car_events_insert/update` | Writes `car_events` rows on insert/update |
| `cars` | `trg_cars_block_terminal_status_revert` | Blocks reverts from `delivered`/`scrapped` (owner override) |
| `cars` | `trg_cars_log_status_change` | Writes `system_events` row on status change |
| `cars` | `trg_cars_set_changed_timestamps` | Sets `pdi_changed_at`/`battery_changed_at` |
| `sales_orders` | `trg_sync_car_status_from_sale` | Keeps `cars.status` in sync with order lifecycle |
| `sales_orders` | `trg_sales_orders_block_terminal_status_revert` | Blocks reverts from `delivered`/`cancelled` |
| `sales_orders` | `trg_sales_orders_log_status_change` | Writes `system_events` row |
| `garage_jobs` | `trg_garage_jobs_block_terminal_status_revert` | Blocks reverts from `done`/`cancelled` |
| `garage_jobs` | `trg_garage_jobs_log_status_change` | Writes `system_events` row |
| `parts` | `trg_parts_auto_status` | Recomputes `part_status` from quantity vs min |
| `parts` | `trg_parts_notify_low_stock` | Fans out notifications when crossing `min_quantity` |
| `job_time_entries` | `trg_recompute_job_actual_hours` | Recomputes `garage_jobs.actual_hours` |
| `profiles` | `profiles_block_self_privilege_escalation_trg` | Blocks self privilege climbs |
| `test_drives` | `test_drive_advance_lead` | Auto-advances `customers.lead_status` on return |

`set_updated_at` is wired into every table that has an `updated_at` column.

---

## Row-Level Security (high level)

- **Read:** authenticated users can read most application tables.
- **Write:** mostly capability-gated through both RLS policies and RPC entry checks.
- **Owner:** can do almost anything; bypasses terminal-status guards via `is_owner()`.
- **Profiles:** users may read/update their own row; owner may insert/update others.
- **Commissions / financials:** restricted reads (owner / beneficiary / `view_reports` / `cashier`).
- **Service role:** used by privileged RPCs (e.g. `notify_expiring_warranties`) and Edge Functions.

---

## Migration apply order (as of 068)

```
053  garage_workflow_buildout
054  rls_perf
055  index_cleanup
056  sales_pipeline (+ 056b complete_delivery_fix)
057  fix_profiles_escalation_trigger_department_column
058  cars_scrapped_enum_value
059  cars_scrapped_constraint_and_cleanup
060  lockdown_security_definer_functions
061  tighten_policy_roles_and_fk_indexes
062  hard_integrity_checks_and_rpc_actor          (>= 0 CHECKs + auth.uid() in create_car/move_car)
063  status_transition_guards                     (terminal-state triggers + garage_jobs.status enum CHECK)
064  rpc_capability_guards                        (capability gates on destructive RPCs; drops dead receive_shipped_car_by_vin)
065  tasks_interactions_appointments              (3 new tables + RLS)
066  suppliers_invoices_commissions               (3 new tables + parts/cars supplier_id FKs)
067  notification_and_audit_triggers              (parts low-stock fan-out + status_change audit + warranty cron fn)
068  lockdown_internal_definer_fns                (revoke REST EXECUTE on internal/trigger DEFINER fns)
```

---

## Extension notes

When adding tables/columns:

1. Define ownership: which capability/role read/writes? Tied to which root entity (`car`, `customer`, `profile`)?
2. Add migration in `supabase/migrations/<NNN>_<name>.sql`. Idempotent constructs (`if not exists`, `or replace`).
3. Always: enable RLS, add policies, add `set_updated_at` trigger if `updated_at` exists, index FKs.
4. If the table exposes a SECURITY DEFINER RPC, gate with `_require_any_capability(...)` at the function entry and revoke EXECUTE from `anon`/`authenticated` if it's purely internal.
5. Update this doc.
