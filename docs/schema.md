# Monza App — Database Schema (Supabase)

> Source of truth for the application's logical data model. Exact DDL lives in `supabase/migrations/`. Last refreshed after migration `132_sales_order_deposit_requires_quote` (launch sprint, 2026-05-19).

---

## Overview

- **Engine**: PostgreSQL 17 (Supabase project `okxpsvukzjjubinhamek`, region eu-central-1)
- **Access**: Supabase REST, Realtime, RPC; service-role from Edge / Vercel server only
- **Auth**: Supabase Auth (`auth.users`) + `public.profiles` (1:1 by `id`)
- **Security**: Row-Level Security (RLS) enabled on every application table; capability-based RPC guards via `_require_any_capability()`; role helpers `is_owner()`, `has_capability()`, `is_any_role_resolved()`

High-level domains:

- **Inventory** — `cars`, `cars_display`, `cars_missing_data`, `car_events`, `car_warranties`, `car_documents`, `car_service_status`, `service_intervals`
- **CRM** — `customers`, `customers_display`, `customer_notes`, `customer_documents`, `customer_interactions`, `customer_credits`, `customer_credit_balance` (view), `requests`
- **Sales** — `sales_orders`, `payment_plans`, `installment_payments`, `test_drives`, `invoices`, `commissions`, `repair_proposals`, `repair_proposal_items`
- **Garage** — `garage_jobs`, `garage_bays`, `garage_capacities`, `garage_tasks`, `garage_task_templates`, `garage_task_template_items`, `parts`, `part_movements`, `job_parts`, `job_documents`, `job_time_entries`, `bay_assignment_history`, `garage_job_bay_context`, `task_timers`, `accessory_inventory`, `accessory_custom_tables`, `accessory_custom_items`
- **Warranty** — `warranty_cases`, `warranty_case_parts`, `warranty_case_documents`, `warranty_notifications_sent`
- **Recalls** — `recalls`, `recall_vehicles`
- **Refunds** — `refunds`
- **Trade-ins** — `trade_ins`, `trade_in_issues`, `trade_in_documents`
- **Cash reconciliation** — `cash_drawers`, `cash_sessions`, `cash_movements`, `cash_settings`
- **PO lifecycle** — `purchase_orders`, `purchase_order_lines`, `purchase_order_receipts`, `purchase_order_receipt_lines`, `purchase_order_invoices`, `purchase_order_payments`
- **Procurement** — `suppliers`
- **Scheduling** — `appointments`, `tasks`, `task_categories`, `task_routing_rules`
- **Users / Roles** — `profiles` (RBAC: `user_role` + `user_capability[]`)
- **Approvals** — `approval_thresholds`
- **Notifications & Audit** — `notifications`, `notification_event_rules`, `notification_preferences`, `push_subscriptions`, `system_events`, `service_day_notifications_sent`, `warranty_notifications_sent`, `delete_requests`, `document_access_requests`, `page_access_requests`
- **Reports (views)** — `report_aged_receivables`, `report_garage_time_in_state`, `report_inventory_aging`, `report_sales_margin`, `report_sales_rep_performance`, `garage_bay_utilization`, `garage_employee_efficiency`, `garage_job_efficiency`
- **System** — `system_preferences`, `infrastructure_compute_target`

Total: 71 base tables + 13 views (live snapshot after mig 132).

---

## Enums

| Enum | Values |
|---|---|
| `car_document_type` | pdi, job_card |
| `car_event_type` | created, moved, status_changed, battery_updated, pdi_updated, details_updated, note_added |
| `car_status` | inbound, in_stock, showroom, reserved, sold, delivered, service, sent_to_sub_dealer, demo, registered, under_registration, sent_to_customs, company_car, inventory, test_drive, available, scrapped |
| `customs_status` | pending, in_progress, cleared, exempt |
| `garage_task_status` | pending, in_progress, blocked, done, cancelled |
| `installment_status` | upcoming, due, overdue, partial, paid, waived |
| `job_priority` | low, normal, urgent |
| `job_status` | pending, in_progress, waiting_parts, done, cancelled |
| `lead_source` | walk_in, phone, whatsapp, instagram, facebook, website, referral, event, other |
| `lead_status` | new_lead, contacted, interested, test_drive, negotiation, converted, lost |
| `location_type` | showroom1, showroom2, garage, storage, inventory |
| `notification_category` *(new in 087a)* | mention, assignment, approval, reply, status_change, alert, customer, critical |
| `notification_severity` *(new in 087a)* | info, warning, urgent, critical |
| `part_status` | in_stock, low_stock, out_of_stock, discontinued |
| `payment_plan_status` | active, completed, defaulted, cancelled |
| `payment_type` | full, installments |
| `pdi_status` | pending, in_progress, done |
| `sale_status` | reserved, draft, confirmed, paid, delivered, cancelled |
| `shipping_status` | pending, in_transit, arrived_port, customs, ready, received |
| `user_role` | owner, sales, garage_manager, assistant, khalil_hybrid, it, garage_staff, sales_ops, hybrid |
| `user_capability` | garage, vehicle_software, cashier, events_ops, manage_team, edit_users, deactivate_users, view_reports, inventory, sales, data_health |

Changes since migration 068:

- New enums: `notification_severity`, `notification_category` (087a)
- `installment_status` gained `partial` (084a)
- `user_role` gained `hybrid` and the renamed `khalil_hybrid` is still present for back-compat (handled via `is_any_role_resolved()` which auto-expands hybrid to assistant)
- New roles `sales_ops`, `garage_staff` admitted to assistant-side policies in mig 088 / 114

---

## Core tables — by domain

### Inventory

#### `cars`
Inventory; one row per physical vehicle (VIN unique).
- `vin text unique`, `brand`, `model`, `model_year`, `trim`, `exterior_color`, `interior_color`, `plate_number`, `engine_number`, `suffix`, `specs`
- `status car_status` — terminal states `delivered` / `scrapped` (trigger 063)
- `location_type location_type`, `location_slot text`, `location_floor text`, `location_changed_at`, `status_changed_at`
- `pdi_status`, `customs_status text` (free-text, not enum), `customs_amount_paid`, `customs_amount_currency`, `customs_notes`
- `battery_percent integer`, `km_range`, `current_km`, `software_version`, `software_update`, `dongle`, `is_erev bool`, `ev_km`, `motor_km`
- `price`, `price_currency` (default USD), `supplier_id → suppliers.id` (062, 066)
- Warranty cols: `warranty_per_dms date`, `warranty_expiry`, `warranty_monza_start_date`, `warranty_vehicle_expiry`, `warranty_battery_expiry`
- Reservation/sale cols: `customer_id`, `reservation_date`, `sold_marker`, `sold_at`, `delivery_date`, `registration_date`, `bl_issue_date`, `date_bought`, `date_arrived`
- `sub_dealer_name`, `issue`, `notes`
- Audit: `created_at`, `created_by`, `updated_at`, `deleted_at`
- CHECKs: numeric `>= 0` on price/customs; terminal-status trigger blocks reverts.

#### `cars_display` (view)
SELECT-only convenience view joining lookups for the UI grid.

#### `cars_missing_data` (view)
Filters rows with missing critical fields (used by data-health dashboard).

#### `car_events`
Event log: insert/move/status/PDI/battery/note (typed by `car_event_type`). Written by `log_car_events()` trigger.

#### `car_warranties`
External warranty registry, separate from per-car columns; consumed by `notify_expiring_warranties()`.

### CRM

#### `customers`
Doubles as the leads table (no separate `leads`).
- `first_name`, `last_name`, `phone_primary` (E.164 normalized via `normalize_phone()`), `phone_secondary`, `email`, `company`, `address`, `date_of_birth`, `notes`
- `lead_status lead_status`, `lead_source lead_source` — populated by sales pipeline
- Audit + `deleted_at`
- Trigger `trg_customers_block_delete_with_active_orders` (083) blocks soft-deletes when active orders exist
- `gdpr_anonymize_customer(p_customer_id, p_reason)` zeroes PII while retaining audit trail (079)

#### `customer_notes`, `customer_documents`, `customer_interactions`
Per-customer free-text, uploaded files, and comms log respectively. After mig 126, sales-ops can read/write these (was assistant-only).

#### `customer_credits`, `customer_credit_balance` (view)
Track credit memos (e.g. refunds that don't refund cash). The view aggregates `SUM(amount)` per customer.

### Sales

#### `sales_orders`
Connects cars and customers; encodes the sales lifecycle.
- `car_id → cars.id`, `customer_id → customers.id`
- `status sale_status` — terminal `delivered`/`cancelled` (063); `delivered → *` revert blocked by trigger (131)
- `quote_amount`, `deposit_amount`, `deposit_paid_at`, `deposit_method`, `selling_price` — all `>= 0`
- **CHECK** (132): if `deposit_amount > 0` then `quote_amount IS NOT NULL` — block "deposit before quote"
- `delivered_at`, `delivered_by`, `delivery_notes`, `void_reason`
- Trigger `trg_sync_car_status_from_sale` keeps `cars.status` in sync
- Trigger `trg_sales_order_deposit_to_cash_movement` (098b) auto-writes a cash movement on deposit payment
- Unique partial index: only one active (`!= cancelled`) sales_order per car (108)

#### `payment_plans`, `installment_payments`
- `payment_plans.status payment_plan_status` (`active`/`completed`/`defaulted`/`cancelled`)
- `installment_payments` per-installment; `apply_installment_payment()` records partial/full payments
- `recover_payment_plan_from_default()` moves a defaulted plan back to active when caught up (081)
- Trigger `trg_installment_payment_to_cash_movement` (098b) auto-attaches to current cash session

#### `test_drives`
- `status` (scheduled/in_progress/returned), `outcome`, `lead_id`, `car_id`, expected/actual return times
- CHECK (105): future-only schedule, max 4h duration, blocks return-before-pickup
- Trigger `tg_test_drives_progress_lead` auto-advances `customers.lead_status` on outcome

#### `invoices`
- `invoice_number unique`, `sales_order_id`, `customer_id`, `total_amount`, `paid_amount`, `currency`, `status`
- CHECK: `paid_amount <= total_amount`
- Trigger `trg_invoices_check_paid_transition` (083) ensures fully-paid before status `paid`

#### `commissions`
- `(sales_order_id, beneficiary_profile_id)` unique, `amount`, `currency`, `status`
- RLS: owner-managed; beneficiary sees their own; `view_reports`/`cashier` capabilities can view

#### `repair_proposals`, `repair_proposal_items`
- Repair estimates needing owner approval over threshold (096)
- Trigger `trg_repair_proposal_owner_approval_notif` fires owner notif when total ≥ threshold

### Garage

#### `garage_jobs`
- `car_id uuid NULL` (110 — allow walk-in jobs without a car); CHECK XOR: either `car_id` or `external_assignee` populated
- `customer_id`, `garage_bay_id`, `assigned_to`
- `status text` CHECK against `job_status` (deduped in 104); terminal `done`/`cancelled` (063)
- `priority job_priority`, `is_battery_only bool`, `category_id → task_categories.id`
- `estimated_hours`, `actual_hours` `>= 0`; `actual_hours` auto-recomputed from `job_time_entries`
- Trigger `trg_garage_jobs_sync_car_location` (093) keeps `cars.location_type` aligned

#### `parts`, `part_movements`, `job_parts`
- `parts`: status auto-maintained by `update_part_status`; low-stock fan-out via `parts_notify_low_stock` (067)
- `part_movements` (124): now written by `record_purchase_order_receipt()` for full GRN audit
- `job_parts` (125): writes go through `use_part_on_job()` / `apply_part_to_job()` — same stock-check logic in both

#### `job_time_entries`
- `start_at`, `end_at`, `notes`; CHECK (106) at most one open entry per (job, technician)
- Trigger recomputes `garage_jobs.actual_hours`

#### `garage_bays`, `bay_assignment_history`, `garage_job_bay_context`
- Bay state machine: `available`/`occupied`/`maintenance`
- `attach_job_to_bay()`, `release_bay()`, `scan_vin_to_bay()` are the only writers

#### `tasks` (general cross-domain)
- `(source_type, source_id)` unique; resurrected by `create_task_from_request()` / `complete_task()`
- `task_categories` defines SLA + default severity; `task_routing_rules` defines fan-out

### Warranty

#### `warranty_cases`
- `case_number unique`, `car_id`, `customer_id`, `job_id`, `recall_id`
- `kind text` (e.g. battery, electronics, body, mechanical), `severity` (low/medium/high/critical), `status` (open/diagnosing/awaiting_parts/in_repair/resolved/closed/rejected)
- `summary`, `notes`, `resolution`, `opened_at/by`, `closed_at/by`
- Status transitions enforced by `set_warranty_case_status()` RPC (121)

#### `warranty_case_parts`
- `case_id`, `part_id`, `description`, `quantity > 0`, `unit_cost`, `notes`

#### `warranty_case_documents`
- `case_id`, `storage_path`, `filename`, `mime_type`, `size_bytes`, `kind text CHECK` (photo/invoice/report/other)

### Recalls

#### `recalls`
- `recall_number unique`, `title`, `description`, `manufacturer`, `affected_models text[]`, `model_year_min/max`, `required_parts`, `estimated_labor_hours`
- `status` (open/active/closed/cancelled), `opened_at`, `closed_at`, `created_by`

#### `recall_vehicles`
- `(recall_id, car_id)` unique
- `status` (pending/notified/scheduled/completed/declined), `notified_at`, `scheduled_at`, `completed_at`, `completed_by`, `job_id` link

### Refunds

#### `refunds`
- `refund_number unique`, `kind text CHECK` (sale_deposit, part_return, warranty, goodwill, install_overpay, other)
- `customer_id`, optional `job_id`, `invoice_id`, `warranty_case_id`, `part_id`, `quantity`
- `amount > 0`, `currency`, `reason`, `notes`
- `approval_required text CHECK` (none/manager/owner), `status text CHECK` (requested/approved/rejected/paid/cancelled)
- Full audit: requested/approved/rejected/paid `_at/_by`, `rejection_reason`, `payment_method`
- Trigger `trg_refund_payment_to_cash_movement` (116): auto-attaches a cash movement when transitioning to `paid`
- Trigger `block_owner_self_approve_refund` (120): owner who requested cannot self-approve

### Trade-ins

#### `trade_ins`
- `trade_in_number unique`, `customer_id`, `vehicle_*` (make/model/year/vin/plate/color/trim), `mileage_km`
- `provisional_value` (request-time), `recommended_value` (inspection), `accepted_value` (approval), `estimated_repair_cost`
- `condition text CHECK` (poor/fair/good/excellent)
- `status text CHECK` (requested/inspecting/inspected/approved/rejected/committed/cancelled)
- Full audit timestamps for each lifecycle step
- `linked_sales_order_id` set by `commit_trade_in_to_sale()` (130: also matches customer)
- CHECKs: `*_value >= 0`; `committed_has_link`, `committed_has_value`, `approved_has_value`

#### `trade_in_issues`
- Inspection findings: `description`, `severity` (minor/moderate/major), `estimated_cost`

#### `trade_in_documents`
- Photos, registration, inspection-report uploads

### Cash reconciliation

#### `cash_drawers`
- `name unique`, `active` — one row per physical drawer

#### `cash_sessions`
- `(drawer_id, business_date)` plus open-session uniqueness — only one open session per drawer
- `business_date` derived in Asia/Beirut TZ (mig 118)
- `opening_balance >= 0`, `closing_actual`, `variance` (computed), `status text CHECK` (open/closed/reviewed)
- Trigger `cash_sessions_lock_close_fields` (107): blocks edits to closed sessions

#### `cash_movements`
- `session_id`, `kind text CHECK` (sale_deposit, install_pay, refund_out, po_payment, manual_in, manual_out, opening_count, closing_count)
- `direction text CHECK` (in/out), `amount > 0`, `currency`, `source_type/_id` polymorphic link
- Trigger `cash_movements_lock_closed_session` (107): blocks INSERT/UPDATE/DELETE on closed sessions

#### `cash_settings`
- Singleton row (`cash_settings_singleton` CHECK ensures `id = 'global'`)
- `variance_threshold`, `currency`

### PO lifecycle

#### `purchase_orders`
- `po_number unique` (generated by `generate_po_number()`)
- `supplier_id`, `status text CHECK` (draft/submitted/approved/rejected/sent/partial/received/cancelled)
- `currency`, `estimated_total`, `related_job_id`, `related_car_id`, `notes`
- Full audit: requested/approved/rejected/sent/cancelled timestamps + actors
- Status transitions enforced by RPCs: `submit_purchase_order`, `approve_purchase_order`, `reject_purchase_order`, `send_purchase_order`, `cancel_purchase_order`

#### `purchase_order_lines`
- `(po_id, sort_order)` ordering, `part_id` (nullable for free-text), `part_name`, `oe_number`, `quantity > 0`, `unit_cost`, `line_total`

#### `purchase_order_receipts`, `purchase_order_receipt_lines`
- GRN (goods-received note) header + per-line `quantity_received`, `condition CHECK` (good/damaged/short)
- 123: trigger blocks `quantity_received > quantity_ordered` (no over-receipt)
- 124: writes `part_movements` row per accepted line (audit trail to inventory)

#### `purchase_order_invoices`
- Supplier-side invoice attached after GRN
- `supplier_invoice_number`, `invoice_date`, `amount`, `currency`, `vat_amount`, `due_at`, `file_url`, `status` (open/partial/paid/disputed)

#### `purchase_order_payments`
- Payments against invoices (or PO directly)
- Trigger `trg_po_payment_to_cash_movement` (117): auto-attaches to cash session

### Approvals

#### `approval_thresholds`
- `id text` (e.g. `repair_estimate`, `refund_payout`), `label_en`, `description`
- `currency`, `manager_floor`, `owner_floor`, `active`
- Consulted by `required_approver(kind, amount) → ('none'|'manager'|'owner')`
- Seeded by mig 129 (idempotent `ON CONFLICT DO NOTHING`)

### Notifications V2

#### `notifications`
- `user_id`, `title`, `message`, `link`, `category notification_category`, `severity notification_severity NOT NULL`
- `event_type`, `related_entity_type/id`, `metadata jsonb`
- Read state: `is_read` (legacy bool) auto-synced with `read_at` by trigger `trg_notifications_sync_is_read`
- `dismissed_at`, `snoozed_until`, `delivered_email_at`, `delivered_whatsapp_at`

#### `notification_event_rules`
- `event_type text`, `category`, `severity`, `recipient_kind` (user/role/capability), `recipient_value`
- `channel_inapp/email/whatsapp` booleans; `active`
- Seeded by mig 128 (sales-ops + garage-staff routings)

#### `notification_preferences`
- Per-user toggles: `in_app_enabled`, `email_enabled`, `whatsapp_enabled`, `quiet_hours_start/end`, `digest_categories text[]`, `muted_entity_keys text[]`, `desktop_push`, `sound_on_critical`

#### `push_subscriptions`
- Web-push registrations (`subscription jsonb`); consumed by `/api/send-push`

### Profiles & RBAC

#### `profiles`
- `id uuid pk` = `auth.users.id`
- `user_role user_role`, `capabilities user_capability[]`
- `email` synced from `auth.users` via trigger
- `is_active`, `employment_status`, `terminated_at`, `termination_reason`
- Trigger `profiles_block_self_privilege_escalation_trg`: blocks privilege climbs
- Trigger `trg_block_last_owner_self_demote_upd/del` (115): can't demote/delete the last active owner

---

## RPCs (public API)

~110 functions in the public schema. Grouped by domain. Capability/role gates noted in parens.

### Inventory
- `create_car(...)` (inventory) — `created_by = auth.uid()`
- `move_car(...)` (inventory|garage|sales) — writes `car_events`
- `log_car_events()` — trigger fn (insert + update branches)

### Sales
- `complete_delivery(p_sales_order_id, p_notes)` (sales) — moves order to `delivered`, syncs car
- `void_sales_order(p_sales_order_id, p_reason)` (owner|sales_ops|sales)
- `sync_car_status_from_sale()` — trigger fn

### Garage
- `apply_part_to_job(p_job_id, p_part_id, p_quantity, ...)` (garage) — decrements parts + writes `job_parts` + `part_movements`
- `return_part_from_job(p_job_part_id)` (garage) — reverses an apply
- `use_part_on_job(...)` (garage) — unified entry (125), same stock-check as `apply_part_to_job`
- `move_part_stock(...)` (garage|inventory) — manual stock adjust
- `attach_job_to_bay(p_job_id, p_bay_id)` (garage) — battery-lab type-match validation
- `release_bay(...)`, `scan_vin_to_bay(p_vin, p_bay_id)` (garage)
- `set_garage_job_category(p_job_id, p_category_id, p_current_km)` (garage) — applies template
- `delete_job_time_entry(p_entry_id)` (garage)
- `recompute_job_actual_hours()` — trigger fn

### Payment plans
- `create_payment_plan(...)` (sales|cashier) — atomic creation w/ down payment (111)
- `apply_installment_payment(p_installment_id, p_amount, ...)` (cashier)
- `recover_payment_plan_from_default(p_plan_id, p_reason)` (owner|cashier)
- `advance_installment_statuses()` — cron fn (upcoming → due → overdue)

### Cash reconciliation
- `open_cash_session(p_opening_balance, p_drawer_id, p_note)` (cashier)
- `close_cash_session(p_session_id, p_actual_balance, ...)` (cashier)
- `record_manual_cash_movement(p_kind, p_direction, p_amount, ...)` (cashier)
- `cash_movements_lock_closed_session()`, `cash_sessions_lock_close_fields()` — trigger fns
- `installment_payment_to_cash_movement()`, `refund_payment_to_cash_movement()`, `po_payment_to_cash_movement()`, `sales_order_deposit_to_cash_movement()` — auto-attach triggers

### Refunds
- `request_refund(p_kind, p_customer_id, p_amount, p_reason, ...)` (sales|cashier|garage_manager)
- `approve_refund(p_refund_id)` (owner|manager — uses `required_approver()`)
- `reject_refund(p_refund_id, p_reason)` (owner|manager)
- `mark_refund_paid(p_refund_id, p_method)` (cashier)
- `cancel_refund(p_refund_id)` (owner|manager|requester before approval)
- `generate_refund_number()` — sequence helper

### Trade-ins
- `request_trade_in(p_customer_id, p_vehicle_*, p_provisional_value, ...)` (sales)
- `start_trade_in_inspection(p_trade_in_id)` (garage|sales_ops)
- `complete_trade_in_inspection(p_trade_in_id, p_condition, p_recommended_value, ...)` (garage|sales_ops)
- `approve_trade_in(p_trade_in_id, p_accepted_value)` (owner|sales — threshold-gated)
- `reject_trade_in(p_trade_in_id, p_reason)` (owner|sales)
- `cancel_trade_in(p_trade_in_id, p_reason)`
- `commit_trade_in_to_sale(p_trade_in_id, p_sales_order_id)` (sales) — links + matches customer (130)
- `generate_trade_in_number()`

### Warranty / Recalls
- `set_warranty_case_status(p_case_id, p_status, p_note)` (garage|owner) — state-machine guard (121)
- `set_recall_status(p_recall_id, p_status)` (owner|garage_manager) (122)
- `assign_recall_vehicles(p_recall_id, p_car_ids[])` (owner|garage_manager)
- `mark_recall_vehicle(p_recall_vehicle_id, p_status, p_job_id, p_notes)` (garage)
- `generate_warranty_case_number()`, `generate_recall_number()`
- `detect_warranty_expiry()` — cron fn (092)
- `notify_expiring_warranties(p_threshold_days)` — internal; revoked from REST (068)

### Purchase orders
- `submit_purchase_order(p_po_id)` (garage_manager|inventory)
- `approve_purchase_order(p_po_id)` (owner|sales_ops — threshold-gated)
- `reject_purchase_order(p_po_id, p_reason)` (owner|sales_ops)
- `cancel_purchase_order(p_po_id, p_reason)` (owner|requester)
- `send_purchase_order(p_po_id, p_supplier_contact, p_supplier_reference, p_expected_delivery)` (garage_manager|inventory)
- `record_purchase_order_receipt(p_po_id, p_grn_number, p_received_lines jsonb, ...)` (garage|inventory) — over-receipt blocked (123), writes `part_movements` (124)
- `attach_purchase_order_invoice(p_po_id, p_invoice_no, p_invoice_date, p_amount, ...)` (inventory|sales_ops)
- `record_purchase_order_payment(p_po_id, p_invoice_id, p_amount, p_method, ...)` (cashier)
- `generate_po_number()`

### Customer
- `gdpr_anonymize_customer(p_customer_id, p_reason)` (owner) — irreversible PII scrub
- `tg_customers_block_delete_with_active_orders()` — trigger fn

### Tasks / Requests
- `create_task_from_request(p_request_id, p_created_by_user_id)`
- `complete_task(p_task_id)`
- `send_workflow_reminders()` — cron fn (082)
- `advance_lead_on_test_drive_return()` — trigger fn
- `tg_requests_sync_send_to()`, `tg_test_drives_progress_lead()`

### Notifications
- `emit_notification(p_event_type, p_title, p_body, p_related_entity_type, p_related_entity_id, p_link, p_metadata, p_event_subject_user_id, p_event_submitter_id)` — dispatcher (087d)
- `mark_notifications_read(p_ids[])`, `mark_all_notifications_read()`
- `dismiss_notification(p_id)`, `snooze_notification(p_id, p_until)`
- `wake_snoozed_notifications()` — cron (094)
- `purge_old_system_events()` — cron (094)
- `parts_notify_low_stock()` — trigger fn

### Approval threshold
- `required_approver(p_kind, p_amount) → text` — returns `none`/`manager`/`owner`

### Detection crons
- `detect_overdue_test_drives()` (092)
- `detect_service_due()` (095)
- `detect_stuck_garage_jobs()` (082b)
- `detect_warranty_expiry()` (092)

### RBAC helpers (RLS use)
- `is_owner()`, `is_role(p_role)`, `is_any_role(p_roles[])`, `is_any_role_resolved(allowed_roles[])` — auto-expands hybrid/khalil_hybrid (088)
- `has_role(r)`, `has_capability(cap)`
- `get_my_user_role()`, `get_my_user_role_resolved()`
- `is_pipeline_user()`, `can_view_owner_requests()`
- `_require_any_capability(p_caps user_capability[])` — internal guard, NOT REST-callable
- `resolve_actor_id(p_user_id)` — normalizes nullable actor → `auth.uid()`
- `active_test_drive_id_for_car(p_car_id)`

### Auth glue
- `handle_new_user()` — `auth.users` insert trigger creates `profiles` row
- `sync_profile_email_from_auth()` / `sync_profile_email_on_auth_update()`

### Internal / trigger fns (revoked from REST)
- `block_last_owner_self_demote()`, `cars_*`, `garage_jobs_*`, `invoices_check_paid_transition`, `log_status_change_to_system_events`, `notifications_sync_is_read`, `profiles_block_self_privilege_escalation`, `sales_orders_block_terminal_status_revert`, `update_part_status`, `tg_*`, etc.

---

## Triggers (selected)

| Table | Trigger | Purpose |
|---|---|---|
| `cars` | `trg_log_car_events_insert/update` | Writes `car_events` rows |
| `cars` | `trg_cars_auto_create_garage_job` | When `location_type → garage`, opens/attaches a `garage_jobs` row (089) |
| `cars` | `trg_cars_block_terminal_status_revert` | Blocks reverts from `delivered`/`scrapped` (owner override) |
| `cars` | `trg_cars_log_status_change` | Writes `system_events` row |
| `cars` | `trg_cars_set_changed_timestamps` | Sets `pdi_changed_at`/`battery_changed_at` |
| `sales_orders` | `trg_sync_car_status_from_sale` | Keeps `cars.status` in sync |
| `sales_orders` | `trg_sales_orders_block_terminal_status_revert` | Blocks revert from `delivered`/`cancelled` (131 extends to `delivered`) |
| `sales_orders` | `trg_sales_order_deposit_to_cash_movement` | **New (098b)** — auto-attaches deposit to current cash session |
| `garage_jobs` | `trg_garage_jobs_block_terminal_status_revert` | Blocks revert from `done`/`cancelled` |
| `garage_jobs` | `trg_garage_jobs_sync_car_location` | Syncs `cars.location_type` from job state (093) |
| `parts` | `trg_parts_auto_status` | Recomputes `part_status` from quantity vs min |
| `parts` | `trg_parts_notify_low_stock` | Fans out notifications on min-quantity crossing |
| `job_time_entries` | `trg_recompute_job_actual_hours` | Recomputes `garage_jobs.actual_hours` |
| `profiles` | `profiles_block_self_privilege_escalation_trg` | Blocks self privilege climbs |
| `profiles` | `trg_block_last_owner_self_demote_upd/del` | **New (115)** — can't demote/delete last active owner |
| `notifications` | `trg_notifications_sync_is_read` | Keeps legacy `is_read` aligned with `read_at` |
| `installment_payments` | `trg_installment_payment_to_cash_movement` | **New (098b)** — auto-attaches partial/full installment to current cash session |
| `refunds` | `trg_refund_payment_to_cash_movement` | **New (116)** — auto-attaches refund payout to cash session on status → `paid` |
| `purchase_order_payments` | `trg_po_payment_to_cash_movement` | **New (117)** — auto-attaches PO payment to cash session |
| `cash_movements` | `cash_movements_lock_closed_session` | **New (107)** — blocks writes against closed sessions |
| `cash_sessions` | `cash_sessions_lock_close_fields` | **New (107)** — blocks edits to closing fields after close |
| `test_drives` | `test_drive_advance_lead` / `trg_test_drives_progress_lead` | Auto-advances `customers.lead_status` on outcome |
| `repair_proposals` | `trg_repair_proposal_owner_approval_notif` | Fires owner notif when total ≥ threshold (096b) |
| `repair_proposals` | `trg_repair_proposals_sync_checklist` | Syncs proposal items into checklist on accept |
| `customers` | `trg_customers_block_delete_with_active_orders` | Blocks soft-delete while orders active |
| `accessory_inventory` | `trg_accessory_inventory_audit` | Sets `created_by`/`updated_by` from auth.uid() |
| `requests` | `trg_requests_sync_send_to` | Mirrors `send_to_user_id` into `send_to_role` |
| `invoices` | `trg_invoices_check_paid_transition` | Ensures fully-paid before status `paid` (083) |
| `*` (many) | `set_updated_at` | Touches `updated_at` on UPDATE |

Note: the `sales_order_deposit_requires_quote` rule (132) is a CHECK constraint, not a trigger, but is part of the same lifecycle gating story.

---

## Row-Level Security (high level)

- **Capability gate**: `_require_any_capability(caps[])` is the RPC entry guard for destructive operations (parts mutation, sales lifecycle, GRN, refund/PO state machines). RLS policies on tables generally permit broad SELECT and restrict writes to capability holders or row owners.
- **Role resolution**: `is_any_role_resolved(roles[])` is preferred over `is_any_role()` because it auto-expands `hybrid`/`khalil_hybrid` to assistant-level access for the policies that took those roles into the assistant pool (mig 088). This is why a `hybrid` user can read/write notes the same as an `assistant`.
- **Profiles**: users read/update their own row; owner inserts/updates others; trigger blocks self privilege escalation; trigger blocks demoting the last active owner (115).
- **Commissions / financials**: restricted reads (owner / beneficiary / `view_reports` / `cashier`).
- **Garage staff** (mig 114): `garage_staff` can SELECT `garage_jobs` and `cars` to do their work (was assistant-only).
- **Sales ops** (mig 126 + 128): `sales_ops` can read/write `customer_notes`, `customer_documents`, `customer_interactions`, and is in the recipient list for the new notification rules.
- **Reports views** (mig 101): `anon` is revoked from all `report_*` views (they had been world-readable).
- **Service role**: used by privileged RPCs (`notify_expiring_warranties`), Edge Functions (`send-push`), and the `/api/admin/*` routes.
- **Storage** (mig 127, manual): `customer-documents` and `job-documents` buckets are scoped by the first folder segment matching a real `customer_id`/`job_id` plus a role check. Applied via Dashboard SQL editor only (postgres role can't own `storage.objects`).

---

## Migration apply order (053 → 132)

Phase A (053–068) — initial hardening; reference-only:

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
064  rpc_capability_guards                        (capability gates on destructive RPCs)
065  tasks_interactions_appointments              (3 new tables + RLS)
066  suppliers_invoices_commissions               (3 new tables + parts/cars supplier_id FKs)
067  notification_and_audit_triggers              (parts low-stock + status_change audit + warranty cron fn)
068  lockdown_internal_definer_fns                (revoke REST EXECUTE on internal DEFINER fns)
```

Phase B (069–098) — workflow + reconciliation:

```
069  revoke_helper_fn_api_access                  (RLS helpers revoked from REST)
070  harden_task_rpcs                             (capability checks on task RPCs)
071  fk_covering_indexes                          (perf)
072  rls_initplan_fixes                           (perf — auth.uid() in subselects)
073  accessory_inventory                          (typed columns for the spreadsheet)
074  installment_status_cron                      (advance_installment_statuses)
075  audit_sprint1_quickwins                      (post-sprint audit fixes)
076  sales_lifecycle_gating                       (sales_order status transitions)
077  customer_data_integrity                      (phone normalize, dedup)
078  sales_currency_and_void                      (currency on sales_orders + void_sales_order)
079  gdpr_anonymize_customer                      (PII scrub RPC)
080  workflow_logic_gaps                          (assorted small fixes)
081  plan_recovery_and_time_entry_delete          (recover_payment_plan_from_default + delete_job_time_entry)
082  workflow_reminders_cron (+ 082b CTE fix)     (send_workflow_reminders cron)
083  void_safety_and_invoice_paid_guard
084a add_partial_installment_status
084b installment_payment_policy
085  restore_rls_helper_execute_grants
086  restore_rls_helper_execute_grants_phase_2
087a notifications_v2_schema                     (notification_severity/category enums + columns)
087b task_categories_and_routing_rules
087c notification_event_rules
087d emit_notification_dispatcher                (emit_notification RPC)
087e enable_realtime_for_notifications
088  hybrid_role_pool_inclusion                   (is_any_role_resolved expands hybrid → assistant)
089  auto_create_garage_job_on_arrival (v2)
090  garage_job_intake_fan_out (+ 090b cast fix, 090c open-status, 090d unique assignee)
091  owner_reports_views                          (report_aged_receivables + 4 more)
092  test_drive_and_warranty_crons                (detect_overdue_test_drives + detect_warranty_expiry)
093  auto_sync_car_location_with_garage_jobs (+ 093b enum cast)
094  retention_and_snooze_wakeup_crons            (purge_old_system_events + wake_snoozed_notifications)
095  maintenance_reminder_loop                    (detect_service_due)
096  approval_thresholds_and_estimate_gate (+ 096b owner-approval notif)
097  purchase_orders_lifecycle                    (6 PO tables + status CHECKs)
097b purchase_order_rpcs                         (submit/approve/reject/send/receipt/invoice/payment RPCs)
098  cash_reconciliation                          (drawers/sessions/movements/settings)
098b cash_rpcs_and_triggers                      (open/close + auto-attach triggers)
098c close_cash_session_remove_closing_count_movement
```

Phase B7 (099) — warranty / recall / refund:

```
099  warranty_recall_refunds                     (3 domain table sets + RLS)
099b warranty_recall_refund_rpcs                 (request/approve/reject/mark_paid/cancel + recall ops)
```

Phase B4 (100) — trade-ins:

```
100  trade_ins                                   (3 tables + RLS)
100b trade_in_rpcs                               (request/start/complete/approve/reject/cancel/commit)
```

Hot fixes from QA (101–113):

```
101  revoke_anon_report_views                    (drop public SELECT on report_*)
102  warranty_notifications_type_check           (warranty_notifications_sent.warranty_type CHECK)
103  suppliers_kind_check_align                  (align kind text CHECK with code)
104  drop_duplicate_garage_jobs_status_check     (dedup overlapping CHECK)
105  test_drives_validation_checks               (future-only + 4h max + return-after-pickup)
106  job_time_entries_one_open                   (at-most-one-open per job+tech)
107  lock_closed_cash_sessions (+ _fix)          (block writes to closed sessions)
108  sales_orders_one_active_per_car             (partial unique idx, !cancelled)
109  fix_log_car_events_missing_columns          (column drift in log_car_events)
110  garage_jobs_car_id_nullable_and_external_assignee  (walk-in jobs, XOR CHECK)
111  create_payment_plan_rpc                     (atomic plan+down payment+installments)
112  installment_no_allow_zero_down              (CHECK: down_payment > 0 if plan_type='installments')
113  fix_cash_trigger_on_conflict_predicate
```

Launch sprint (114–132):

```
114  garage_staff_rls_for_jobs_and_cars          (garage_staff SELECT)
115  block_last_owner_self_demote                (last-owner protection trigger)
116  cash_auto_attach_refund_payments            (trigger: refunds → cash_movements)
117  cash_auto_attach_po_payments                (trigger: PO payments → cash_movements)
118  business_date_beirut_tz                     (cash_sessions.business_date in Asia/Beirut)
119  block_cash_install_no_session               (CHECK: no install pay without open session)
120  block_owner_self_approve_refund             (owner can't approve own refund req)
121  warranty_case_status_rpc                    (set_warranty_case_status state machine)
122  recall_status_rpc                           (set_recall_status state machine)
123  grn_over_receipt_block                      (GRN qty_received <= qty_ordered)
124  grn_writes_part_movements                   (GRN appends part_movements audit)
125  unify_use_part_on_job_stock_check           (use_part_on_job matches apply_part_to_job)
126  customer_notes_documents_rls_sales_ops      (sales_ops can read/write)
127  storage_doc_policies_scoped                 (** MANUAL Dashboard apply ** — storage.objects RLS by folder)
128  notification_rules_sales_ops_garage_staff   (seed rules for new roles)
129  approval_thresholds_seed_guarded            (idempotent ON CONFLICT seed)
130  commit_trade_in_customer_match              (commit_trade_in_to_sale matches customer_id)
131  sales_order_delivered_revert_block          (extend terminal-revert block to delivered)
132  sales_order_deposit_requires_quote          (CHECK: deposit > 0 ⇒ quote_amount NOT NULL)
```

---

## Extension notes

When adding tables/columns:

1. Define ownership: which capability/role read/writes? Tied to which root entity?
2. Add migration in `supabase/migrations/<NNN>_<name>.sql`. Idempotent constructs (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP CONSTRAINT IF EXISTS`, `ON CONFLICT DO NOTHING`).
3. Always: enable RLS, add policies, add `set_updated_at` trigger if `updated_at` exists, index FKs.
4. SECURITY DEFINER RPCs must:
   - `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;`
   - `SET search_path TO 'public', 'pg_temp';`
   - Call `_require_any_capability(...)` or `is_any_role_resolved(...)` at entry.
5. `created_by` columns must be populated via trigger or RPC body — **never** trust the caller's value. If you accept it in an RPC param, validate with `resolve_actor_id(p_user_id)` (it falls back to `auth.uid()`).
6. Any change to `storage.objects` policies (rare) must be applied via the Dashboard SQL editor — the MCP runner authenticates as `postgres`, which can't own `storage.objects`. Mark the migration with a manual-apply header (see `127_storage_doc_policies_scoped.sql` for the pattern).
7. Update this doc.
