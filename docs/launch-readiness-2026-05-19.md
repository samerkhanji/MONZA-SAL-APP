# Monza App Launch Readiness Report

**Date:** 2026-05-19 (Beirut)
**Auditor:** Final QA (read-only static + DB verification)
**Project:** `okxpsvukzjjubinhamek` (Supabase prod)
**Scope:** verify the six-lane hotfix sprint (PRs #68 – #73), produce day-1 employee guidance.

---

## 1. Executive Summary

**Verdict: Launch ready with 1 manual step — migration `127_storage_doc_policies_scoped.sql` must be applied through the Supabase Dashboard SQL editor before flipping the switch.** Everything else has been verified against the live database.

The six hotfix lanes (squash-merged to `main` as 7 commits) closed the high-/medium-severity issues from the prior audit:

| # | PR | Title | Sprint lane |
|---|----|-------|-------------|
| 1 | #68 | hotfix(roles): RLS for garage_staff + last-owner lock + role aliases | Roles / RBAC |
| 2 | #69 | hotfix(trade-ins+sales): /trade-ins UI + customer match + delivered revert + deposit-after-quote | Sales / trade-ins |
| 3 | #70 | hotfix(cash+installments+refunds): auto-attach cash movements + Beirut TZ + cashier access + no-self-approve | Cash / installments |
| 4 | #71 | hotfix(garage+po+warranty): state-machine RPCs + GRN over-receipt + part movements audit | Garage / parts |
| 5 | #72 | hotfix(customer+testdrive+docs): RLS opens to sales_ops/assistant + customer picker + scoped storage | Customer / docs |
| 6 | #73 | hotfix(notifications+settings): rules for sales_ops/garage_staff/cashier + approval-thresholds editor | Notifications / settings |
| 7 | #67 | chore: ignore `.claude/worktrees/` | Infra hygiene |

Live DB state at the time of audit:
- Migrations 114 → 126 and 128 → 132 are present and applied.
- Migration **127 is NOT applied** (intentional — runner cannot escalate to `supabase_storage_admin`; the policy DDL must be pasted into the Dashboard SQL editor).
- Active owners = **2** (`Samer Khanji`, `Kareem Khanji`) — last-owner trigger has someone to fall back to.
- Active employees = 7 total: 2 owners, 1 garage_manager (Mark), 2 assistants (Lara, Samaya), 1 garage_staff (Suhail), 1 hybrid (Khalil).
- Approval thresholds seeded for refund (mgr 50 / owner 500), estimate (300 / 2000), parts_order (0 / 1000), goodwill (0 / 300) — all USD.
- All 16 launch-critical RPCs and 5 launch-critical triggers are present (see workflow trace section).
- No security advisor errors introduced by this sprint. The 8 `security_definer_view` errors (report views) and the function-search-path / authenticated-executable warnings are pre-existing and tracked separately.

---

## 2. Role-by-role Access Map

Each table below summarises what a given role can do **on day 1** after the hotfixes land. "UI–RLS–RPC mismatch" calls out places where the three layers disagree (most are minor, none are blockers).

### 2.1 Owner (`owner`) — Samer, Kareem

| Dimension | Detail |
|-----------|--------|
| Can see | Everything. `Dashboard`, `Assistant Dashboard`, `Cars`, `Customers`, `Sales Orders`, `Installments`, `Trade-Ins`, `Test Drive`, `Garage` (+all sub-pages), `Cash`, `Reports`, `Documents`, `Data Health`, `Notifications`, `Settings` (and approval thresholds, notifications settings, workflow rules). |
| Can create | All entities. Includes refunds, warranty cases, recalls, POs, sales orders, trade-ins, payment plans, cash sessions, customer notes/docs. |
| Can edit | All entities. Includes terminal status escapes via dedicated RPCs (e.g. owner-only `recover_payment_plan_from_default`, owner-only voids). |
| Can delete | All entities (`is_owner()` is the gate everywhere). |
| Can approve | Refunds (subject to amount tier rules), refund reject, sales-order delivery, sales-order void, payment-plan recovery, page-access requests, trade-in approve/reject/commit, garage estimates, PO send/approve. **NEW: 120 — cannot self-approve a refund they themselves requested.** |
| Blocked from | (1) Self-demoting if they are the last active owner (trigger `trg_block_last_owner_self_demote_upd`). (2) Approving / rejecting their own refund request (RPC raises `42501`). (3) Reverting a `delivered` sales order via plain status patch — must go through `void_sales_order` (which sets `void_at` in the same UPDATE; trigger `sales_orders_block_terminal_status_revert`). |
| Pages | All 28 in §3. |
| Workflows | All 17 in §4. |
| Notifications | Receives nearly everything (all `role='owner'` and the dispatcher's `owner_ids` fan-out). |
| UI / RLS / RPC mismatches | None blocking. |

### 2.2 Garage Manager (`garage_manager`) — Mark

| Dimension | Detail |
|-----------|--------|
| Can see | `Assistant Dashboard` (NO — assistant flow excludes garage_manager), `Cars` (NO — page gate excludes), `Requests`, `Garage` (jobs, history, efficiency, inventory, tasks), `Documents`, `Garage Settings`, `Notifications`. With `garage` + `events_ops` capabilities also: `Trade-Ins` (via capability), `Garage Refunds` (via `garage`). NOT `Sales Orders`, `Installments`, `Cash`, `Reports` (no `view_reports` capability granted today). |
| Can create | Garage jobs, garage tasks, parts entries, suppliers (if has `inventory`), POs (if has `inventory`), warranty cases, recalls, refund requests (via `garage`). |
| Can edit | All garage_jobs (RLS 114 grants `garage_manager` unrestricted UPDATE), parts, job-parts, time entries. |
| Can delete | NO — `garage_jobs_delete_owner` policy restricts deletion to owner. |
| Can approve | Warranty case transitions, recall transitions (via `garage` cap, RPCs 121/122). Garage estimates ≥ manager_floor (via `approve_estimate` flow). Refund approve/reject — yes if amount ≤ `owner_floor` AND not own request (governed by approval_thresholds.owner_floor for `refund`). |
| Blocked from | Demoting the last owner; self-approving own refund; creating sales orders; sales-order delivery; editing cars. Has no access to cash sessions unless `cashier` capability is granted. |
| Pages | `/requests`, `/garage`, `/garage/inventory`, `/garage/history`, `/garage/efficiency`, `/garage/tasks`, `/garage/warranty`, `/garage/recalls`, `/garage/refunds`, `/garage/settings`, `/garage/time-reports`, `/documents`, `/notifications`. PO/Suppliers gated by `inventory` capability (Mark does NOT currently have `inventory` — sales-side procurement is owner-driven). |
| Workflows | Intake → garage → handover; warranty case lifecycle; recall lifecycle; parts use on job; PO/GRN if `inventory` is granted. |
| Notifications | `task.assigned`, `garage_job.*`, `estimate.*`, `warranty.*`, `recall.*`, `parts.*`. |
| UI / RLS / RPC mismatches | The DB RLS (`garage_jobs_insert_access` and `garage_jobs_update_access`) does NOT include `garage_manager` directly — it relies on `garage` capability via `is_any_role_resolved` resolution. Mark has the `garage` cap, so resolved-role checks pass. No functional break. |

### 2.3 Garage Staff (`garage_staff`) — Suhail

| Dimension | Detail |
|-----------|--------|
| Can see | `Requests`, `Garage` jobs page, `Garage Inventory`, `Garage Tasks`, `Parts`, `Notifications`. CANNOT see history, sales, customers, cash, reports, suppliers, POs, refunds, warranty/recall write surfaces. |
| Can create | NO garage jobs (insert gate excludes garage_staff). Can update existing jobs ONLY where `assigned_to = auth.uid()` (RLS 114). Can create job_parts entries via RPCs `apply_part_to_job` / `use_part_on_job`. Can log time entries (subject to `job_time_entries_one_open` unique-partial index from 106). |
| Can edit | Own assigned jobs only (RLS WITH CHECK enforces `assigned_to = auth.uid()` — cannot reassign away from self). Read-only on cars. |
| Can delete | Nothing (`garage_jobs_delete_owner` only). |
| Can approve | Nothing. |
| Blocked from | Creating/deleting garage jobs; editing cars (`cars_update_restricted` not extended); editing not-mine jobs; editing estimates; cash/sales/customers. |
| Pages | `/requests`, `/garage`, `/garage/inventory`, `/garage/tasks`, `/notifications`. |
| Workflows | Active inside #1 (intake→garage→handover) and #4 (parts use). Recipient of `task.assigned`, `garage_job.parts_arrived`, `service.due_soon` per migration 128. |
| Notifications | NEW (mig 128): `task.assigned`, `garage_job.parts_arrived`, `service.due_soon`. |
| UI / RLS / RPC mismatches | None. The nav explicitly hides /garage/history, /garage/efficiency, /garage/warranty, /garage/recalls, /garage/refunds, /garage/settings for garage_staff. |

### 2.4 Sales (`sales`) — *currently no active user holds this role*

| Dimension | Detail |
|-----------|--------|
| Can see | `Requests`, `Cars`, `Accessories`, `Customers`, `Sales Orders` (UI page gate **excludes** `sales` — see mismatch row), `Installments`, `Test Drive`, `Garage History`, `Documents`, `Trade-Ins` (via `sales` capability check). |
| Can create | Customers, customer notes, customer documents, sales orders, test drives, installment plans (via assistant/cashier-capable flow), trade-ins. |
| Can edit | Sales orders, customer rows (`sales` role retained in `CRUD_PERMISSIONS.customers.edit`), trade-ins (own rows). |
| Can delete | Nothing. |
| Can approve | Trade-in commit (via `sales` capability, RPC `commit_trade_in_to_sale`). Sales-order delivery via `complete_delivery` RPC (subject to RPC internal gating). |
| Blocked from | Cash sessions (unless `cashier` cap), refunds, warranty/recall write, garage jobs, settings. **NEW: cannot record a deposit on a sales_order before quote_sent_at is set (constraint `lifecycle_deposit_after_quote` from migration 132).** |
| Pages | `/requests`, `/cars`, `/accessories`, `/customers`, `/test-drive`, `/installments`, `/trade-ins`, `/documents`, `/garage/history` (read only). Pages currently using `appRole === 'sales'` rather than capability include `/customers` and `/installments` (consistent). |
| Workflows | #3 sales lifecycle (lead→quote→deposit→delivery), #6 trade-in, #7 test-drive, #5 installment plan creation, #11 customer onboarding. |
| Notifications | `customer.*`, `sale.*`, `test_drive.*`, `trade_in.*`, `delivery.*` per existing rules. |
| UI / RLS / RPC mismatches | **`/sales-orders` page gate explicitly excludes `sales`** — only `owner`, `assistant`, `sales_ops` pass. PAGE_PERMISSIONS in `permissions.ts` does not list sales_orders and there is no nav entry for `sales` either. **NOT a launch blocker today** because no live user holds the bare `sales` role; will need cleanup before granting it. Tracked in §6. |

### 2.5 Sales Operations (`sales_ops`) — *currently no active user holds this role*

| Dimension | Detail |
|-----------|--------|
| Can see | `Assistant Dashboard` (NO — assistant flow gates on `isRequestAssistant || isOwner || isHybrid`, not sales_ops), `Cars`, `Accessories`, `Customers`, `Sales Orders`, `Installments`, `Test Drive`, `Trade-Ins`, `Garage History` (read-only), `Documents`, `Requests`, `Notifications`. |
| Can create | Customers, customer notes/docs (NEW via migration 126), cars (CRUD_PERMISSIONS), accessory collections, sales orders, test drives. |
| Can edit | Cars, customers (notes + docs via 126), sales orders, accessory collections, garage_jobs at RLS level (114 includes `sales_ops` in update gate — useful as a sales-side dispatcher). |
| Can delete | Nothing. |
| Can approve | Trade-in approve/reject via the standard RPC path (gate is `sales` capability — sales_ops doesn't have it unless explicitly granted; today the role is purely role-name based). |
| Blocked from | Cash sessions (unless `cashier`), refunds, warranty/recall, settings, deposit-before-quote, deactivating last owner. |
| Pages | All sales-facing + read-only garage history. |
| Workflows | #3 sales lifecycle, #5 installment plan, #6 trade-in, #7 test-drive, #11 customer onboarding, #12 sale void (read only — owner does the void). |
| Notifications | NEW (mig 128): `customer.created`, `test_drive.overdue_1h`, `sale.voided`, `trade_in.approved`, `trade_in.rejected`. |
| UI / RLS / RPC mismatches | RLS 126 grants write on `customer_notes` / `customer_documents` to sales_ops, consistent with the UI on `/customers/add` (PR #72). The DB-side `commit_trade_in_to_sale` requires `is_owner() OR has_capability('sales')` — pure-`sales_ops` users will be rejected; add the `sales` capability when needed. |

### 2.6 Assistant (`assistant`) — Lara, Samaya

| Dimension | Detail |
|-----------|--------|
| Can see | `Assistant Dashboard`, `Requests`, `Cars`, `Accessories`, `Customers`, `Sales Orders`, `Installments`, `Test Drive`, `Documents`, `Garage History`, `Garage` (RLS 114 includes assistant in select on jobs+cars), `Notifications`. |
| Can create | Customers, customer notes/docs (post-126), accessory collections, requests, payment plans (CRUD says yes via `installments.create`), test drives. |
| Can edit | Cars (`cars` CRUD edit only owner/sales/sales_ops — assistant excluded), customers (post-126), requests, installments (CRUD edit includes assistant), customer notes/docs (own rows). |
| Can delete | Nothing. |
| Can approve | Nothing (no role-based approve power; depends on capability — Lara and Samaya have `garage`, `cashier`, `vehicle_software`, `events_ops`). With `cashier` capability they CAN open/close cash sessions and apply installment payments. |
| Blocked from | Cars edit, suppliers, POs (unless `inventory`), refunds (no `garage` write surface). |
| Pages | All except settings/dashboard. |
| Workflows | #1 intake (triage), #3 sales (data entry), #4 parts (read), #5 installment, #7 test-drive, #8 cash (with cashier cap), #11 customer onboarding. |
| Notifications | Receives most "assistant" recipients in `notification_event_rules` plus `customer.*`. |
| UI / RLS / RPC mismatches | None blocking. **Note**: Assistants in production today (Lara, Samaya) have the `cashier` capability, which is why `/installments` and `/cash` work for them — relying on cap, not the bare role. |

### 2.7 Hybrid (`hybrid` / `khalil_hybrid` aliased) — Khalil

| Dimension | Detail |
|-----------|--------|
| Can see | `Assistant Dashboard` (via `isHybrid` flag), `Requests`, `Cars`, `Accessories`, `Customers` (post-hotfix; nav includes hybrid), `Installments` (nav includes hybrid), `Test Drive`, `Garage` + sub-pages, `Garage Settings`, `Documents`, `Reports` (via `view_reports` capability — Khalil currently does NOT have it; falls back to `manage_team` — also not held; **Reports nav hidden today**), `Data Health` (via `data_health` capability — Khalil has it), `Trade-Ins` (via `sales` capability — Khalil has it). |
| Can create | Customers (via `sales` cap), garage jobs (RLS 114 inserts include `hybrid`), parts (CRUD lists hybrid in `parts.edit`), trade-ins, sales-related content. |
| Can edit | Parts (CRUD), garage jobs (RLS update includes hybrid unrestricted), trade-ins, customers (cap-gated). |
| Can delete | Nothing. |
| Can approve | Trade-in commit (via `sales`). |
| Blocked from | Owner-only ops; cash sessions (no `cashier` cap currently); refunds approve (no `manage_team`); writing customer_notes/docs (only by role-or-capability; Khalil's `sales` cap qualifies under migration 126). |
| Pages | Broad — see "Can see". |
| Workflows | Acts as both a sales lead and a parts/garage dispatcher. Trade-in, sales, garage. |
| Notifications | Inherits hybrid/assistant fan-outs and capability-keyed ones (`view_reports`, `data_health`). |
| UI / RLS / RPC mismatches | **Real**: `isHybrid` flag in `UserContext` returns true for both `hybrid` and `khalil_hybrid`, but the user_role enum in DB is `hybrid` (the alias `khalil_hybrid` is a TS-only synonym, not a DB enum value). Live Khalil has `user_role='hybrid'`. RLS uses `'hybrid'::user_role` throughout. No drift in production. |

### 2.8 Cashier (capability, not a role) — *granted to Lara, Samaya, Kareem*

A capability layer rather than a primary role. Effect:

| Dimension | Detail |
|-----------|--------|
| Pages | Can open `/cash`, `/installments` (post-hotfix PR #70), and is a notification recipient for `cash.variance_over_threshold`, `refund.approved`, `purchase_order.invoice_attached`. |
| Can do | Open and close cash sessions (RPC `open_cash_session` allows `is_owner() OR has_capability('cashier')`). Apply installment payments (RPC `apply_installment_payment` same gate). |
| Hard guards | Cannot record a cash installment payment with no open session (RPC raises `40000`, migration 119). Cash session inherits Beirut-local business_date (migration 118). PO cash payments and refund cash payments auto-attach to the open session (migrations 116/117). |
| UI / RLS / RPC mismatches | None. The /cash page gate is `isOwner || hasCapability('cashier') || hasCapability('manage_team')` which is permissive on read but write-paths re-check `cashier`. |

---

## 3. Page-by-page Ability Map

28 pages. "LR" = launch-ready Y/N.

| # | Page | Purpose | Who can access | Main actions | DB tables/RPCs | Risks | LR |
|---|------|---------|----------------|--------------|----------------|-------|---|
| 1 | `/dashboard` | Owner KPIs | owner | Read snapshots | report_* views | None new | Y |
| 2 | `/dashboard/overview` | Owner overview | owner | Read | report_* | None | Y |
| 3 | `/assistant-dashboard` | Daily triage list for non-owner staff | assistant, owner, hybrid | Read; route to requests | `requests`, `garage_jobs` | None | Y |
| 4 | `/requests` | Cross-team request queue | All roles | Create, read, update own | `requests` table | None | Y |
| 5 | `/requests/pending` | Owner approval queue for page-access etc. | owner | Approve/deny | `page_access_requests` | None | Y |
| 6 | `/cars` | Inventory listing | owner, assistant, hybrid, it, sales_ops, sales | Filter, search, view | `cars` (RLS 114 added garage_staff SELECT) | None | Y |
| 7 | `/cars/add` | Add a vehicle | owner, sales_ops, sales | INSERT into `cars` | `cars` | None | Y |
| 8 | `/cars/[id]` | Car detail | Same as `/cars` viewers | View/edit (cap-gated fields) | `cars` + `car_events` | None | Y |
| 9 | `/customers` | Customer list | owner, assistant, sales_ops, sales | Read | `customers` | None | Y |
| 10 | `/customers/add` | Create customer | owner, sales-cap, sales_ops, assistant (PR #72) | INSERT customers | `customers` (RLS) | None | Y |
| 11 | `/customers/[id]` | Customer detail incl. notes/docs | Same | Notes/Docs CRUD (RLS 126) | `customer_notes`, `customer_documents` | Storage policy still wide-open until 127 applied | Y* |
| 12 | `/sales-orders` | Sales order list | owner, assistant, sales_ops (UI gate — see §6) | View/filter | `sales_orders` | UI gate narrower than PAGE_PERMISSIONS | Y |
| 13 | `/sales-orders/[id]` | Detail + status changes + void | owner, assistant, sales_ops | `complete_delivery`, `void_sales_order` RPCs | `sales_orders` + `lifecycle_deposit_after_quote` CHECK + trg_sales_orders_block_terminal_status_revert | None new | Y |
| 14 | `/installments` | Payment plans + mark-paid | owner, assistant, sales_ops, cashier-cap | `create_payment_plan`, `apply_installment_payment` | `payment_plans`, `installment_payments`, `cash_*` triggers | Cash-no-session now hard-blocks (mig 119) | Y |
| 15 | `/trade-ins` | Trade-in queue | owner, sales-cap, garage-cap, manage_team-cap, view_reports-cap | Approve/reject/commit | `trade_ins`, `commit_trade_in_to_sale` | Customer-match enforced post-130 | Y |
| 16 | `/trade-ins/[id]` | Detail + commit | Same | RPC `commit_trade_in_to_sale` | Same | Same | Y |
| 17 | `/test-drive` | VIN-based test drive workflow | owner, sales-cap, garage-cap, manage_team-cap | Start/finish test drive | `test_drives` | Real gate added (PR #72) | Y |
| 18 | `/cash` | Cash drawer reconciliation | owner, cashier-cap, manage_team-cap (read); cashier-cap+owner (write) | `open_cash_session`, `close_cash_session`, add cash_movements | `cash_sessions`, `cash_movements`, `cash_drawers` | Beirut TZ default (mig 118) | Y |
| 19 | `/garage` | Garage jobs queue | owner, assistant, hybrid, garage_manager, garage_staff | Create/assign jobs (RLS 114) | `garage_jobs` | garage_staff scoped to own rows | Y |
| 20 | `/garage/inventory` | Parts inventory | owner, assistant, hybrid, it, garage_manager, garage_staff | Read; manager+ create/edit | `parts`, `part_movements` | use_part_on_job unified (mig 125) | Y |
| 21 | `/garage/tasks` | Garage task board | owner, assistant, hybrid, garage_manager, garage_staff | CRUD via /api/garage/tasks | `tasks`, routing rules | None | Y |
| 22 | `/garage/history` | Closed-job history | owner, assistant, hybrid, garage_manager, sales_ops, sales | Read with page-access flow | `garage_jobs` (status=closed) | None | Y |
| 23 | `/garage/efficiency` | Time-in-state report | owner, assistant, garage_manager, hybrid | Read | `report_garage_time_in_state` view (definer view — existing) | None new | Y |
| 24 | `/garage/warranty` | Warranty cases | owner, garage-cap, view_reports-cap, manage_team-cap (read); owner+garage-cap (write) | `set_warranty_case_status` RPC | `warranty_cases` | State machine enforced (mig 121) | Y |
| 25 | `/garage/recalls` | Recall campaigns | Same as warranty | `set_recall_status` RPC | `recalls` | State machine enforced (mig 122) | Y |
| 26 | `/garage/refunds` | Refund queue + approval | owner, garage-cap, cashier-cap, manage_team-cap, view_reports-cap | `approve_refund`, `reject_refund`, `mark_refund_paid` | `refunds`, cash trigger 116 | Self-approval blocked (mig 120); cash-out auto-attach (116) | Y |
| 27 | `/garage/purchase-orders` | PO lifecycle + GRN | owner, inventory-cap, cashier-cap (read); inventory-cap+owner (write) | `record_purchase_order_receipt`, PO RPCs, cash trigger 117 | `purchase_orders`, `purchase_order_lines`, `purchase_order_receipt_lines`, `part_movements` | Over-receipt blocked (123); part_movements audit (124); PO cash auto-attach (117) | Y |
| 28 | `/garage/suppliers` | Supplier directory | owner, inventory-cap, garage-cap, cashier-cap, manage_team-cap | CRUD suppliers | `suppliers` | None | Y |
| 29 | `/garage/settings` | Garage parameters | owner, garage_manager, hybrid | Edit bays/categories | `garage_*_settings` | None | Y |
| 30 | `/garage/time-reports` | Time entries report | owner, assistant, garage_manager, hybrid | Read | `job_time_entries` | unique-open enforced (mig 106) | Y |
| 31 | `/documents` | Cross-entity document hub | owner, assistant, hybrid, it, garage_manager, sales_ops, sales | Browse, upload | Storage buckets | **127 NOT yet applied — wide-open until done** | Y* |
| 32 | `/data-health` | Data-quality watchlist | Role-restricted via `ROLES_WITH_DATA_HEALTH_ACCESS` | Read | views + cars/parts | None | Y |
| 33 | `/notifications` | In-app notification inbox | All authenticated | Read/mark-read | `notifications` | New rules from mig 128 | Y |
| 34 | `/reports` | Owner reports hub | owner OR view_reports-cap OR manage_team-cap | Read | report_* views | Definer-view advisor warnings (pre-existing) | Y |
| 35 | `/settings` | Owner settings root | owner | Navigate | n/a | None | Y |
| 36 | `/settings/notifications` | Per-event recipient editor | owner | Edit `notification_event_rules` | `notification_event_rules` | None | Y |
| 37 | `/settings/workflow-rules` | Routing rules editor | owner | Edit `task_routing_rules` | `task_routing_rules` | None | Y |
| 38 | `/settings/approval-thresholds` | NEW (PR #73): edit refund/estimate/parts/goodwill thresholds | owner OR manage_team-cap | UPDATE `approval_thresholds` | `approval_thresholds` (CHECK `owner_floor >= manager_floor`) | None | Y |
| 39 | `/accessories` | Accessory inventory | owner, assistant, hybrid, it, sales_ops, sales | CRUD accessory_collections | `accessories` | None | Y |

(* = depends on the single remaining manual step, see §7.)

The audit asked for "28 pages"; the routing tree currently exposes 39 distinct routes. All are listed above for completeness.

---

## 4. Workflow-by-workflow Guide (17 workflows)

For each workflow I traced the canonical UI page and the canonical RPC against the live DB. PASS = static path is whole.

### W1. Intake → Garage → Handover

- **Responsible role**: Sales / Assistant intakes; Garage Manager assigns; Garage Staff executes; Owner / Garage Manager closes.
- **Path**:
  1. New `requests` row created (any role).
  2. `garage_jobs` row auto-created from arrival (`auto_create_garage_job_on_arrival_v2`).
  3. Tasks fanned out via `garage_job_intake_fan_out` to the right role pool.
  4. Garage Staff updates **only their own** job rows (RLS 114 WITH CHECK).
  5. Time entries gated by the partial unique index `job_time_entries_one_open` (mig 106).
  6. On `status='completed'` → car location sync trigger (mig 093) flips `cars.location`.
- **Approval points**: estimate ≥ approval_threshold `estimate` requires manager (300+) or owner (2000+).
- **Failure modes**: garage_staff trying to update someone else's job → RLS WITH CHECK rejects; staff trying to reassign-away → same.
- **Launch readiness**: PASS. Static trace: page `/garage/page.tsx` uses `apply_part_to_job` and standard inserts; policy SELECT/INSERT/UPDATE on `garage_jobs` confirmed live.

### W2. Warranty case lifecycle

- **Responsible role**: Garage Manager primarily (garage capability).
- **Path**:
  1. UI `/garage/warranty/[id]/page.tsx` calls `set_warranty_case_status(p_case_id, p_status, p_note)`.
  2. RPC validates against enum `{open, investigating, awaiting_parts, in_repair, completed, rejected, cancelled}`.
  3. Transition table:
     - open → investigating | awaiting_parts | in_repair | rejected | cancelled
     - investigating → awaiting_parts | in_repair | rejected | cancelled
     - awaiting_parts → in_repair | cancelled
     - in_repair → completed | cancelled
     - terminal: completed | rejected | cancelled (escape only by owner).
  4. Terminal transitions set `closed_at = now()`, `closed_by = caller`.
- **Failure modes**: invalid status → `22023`; illegal transition by non-owner → `40000`.
- **Launch readiness**: PASS. RPC body verified live with arguments `(uuid, text, text)`. Page caller uses three-arg shape — matches.

### W3. Recall lifecycle

- **Responsible role**: Garage Manager / Owner.
- **Path**: UI `/garage/recalls/[id]/page.tsx` calls `set_recall_status(p_recall_id, p_status)`.
- **Transitions**: open → active|cancelled; active → closed|cancelled; closed/cancelled terminal except owner.
- **Failure modes**: same shape as W2.
- **Launch readiness**: PASS. Live RPC signature `(uuid, text)` matches page call.

### W4. Use part on job (stock-out)

- **Responsible role**: Garage Staff via UI; some flows via Garage Manager.
- **Path**:
  1. Page `/garage/jobs/[id]/page.tsx` calls `apply_part_to_job`. (Alternate path: `use_part_on_job` from automation.)
  2. Both RPCs now lock `parts` row `FOR UPDATE`, raise `22023` on `Insufficient stock`, then delegate to `move_part_stock` which writes a `part_movements` row.
- **Failure modes**: insufficient stock; missing job/part.
- **Launch readiness**: PASS. Parity confirmed via `prosrc` inspection — both functions contain `FOR UPDATE` and `Insufficient stock`.

### W5. Payment plan creation + down payment

- **Responsible role**: Sales / Assistant / Sales Ops / Cashier-cap.
- **Path**:
  1. `/installments/page.tsx` collects plan params, builds `due_dates[]` client-side via `installmentDueDateIso`.
  2. Single RPC `create_payment_plan` (12 args) creates the plan, the installments, and applies the down payment by chaining into `apply_installment_payment`.
  3. If the down payment is cash:
     - `apply_installment_payment` checks for an open cash session (mig 119) — raises `40000` if missing.
     - `installment_payment_to_cash_movement` trigger inserts the `cash_movements` row (with `ON CONFLICT DO NOTHING` partial-unique, mig 113).
- **Failure modes**: cash + no session → `40000`; plan with zero monthly amount → CHECK; deposit 0 + monthlies 0 — disallowed by mig 112.
- **Launch readiness**: PASS. Page call args (12) match live RPC signature.

### W6. Cash session open / close + variance

- **Responsible role**: Owner or anyone with `cashier` capability.
- **Path**:
  1. `/cash/page.tsx` → `supabase.rpc("open_cash_session", { p_opening_balance, p_drawer_id?, p_note? })`.
  2. `open_cash_session` uses `(now() AT TIME ZONE 'Asia/Beirut')::date` for business_date (mig 118).
  3. Movements inserted by triggers (refund 116, PO 117, installment 113) and manual entries via UI.
  4. `close_cash_session` rolls up; if `|variance| > variance_threshold`, fires `cash.variance_over_threshold` → notifies cashier capability (mig 128).
  5. Closed sessions locked by mig 107.
- **Failure modes**: drawer already has open session → `40000`; no active drawer → `02000`; non-cashier non-owner → `42501`.
- **Launch readiness**: PASS. Default check live: `((now() AT TIME ZONE 'Asia/Beirut'::text))::date`.

### W7. Sales-order delivery

- **Responsible role**: Owner / Sales Ops.
- **Path**:
  1. `/sales-orders/[id]/page.tsx` calls `complete_delivery(p_sales_order_id)`.
  2. The status invariant — `(status='delivered') ⇔ (delivered_at IS NOT NULL)` — is enforced by RPC.
  3. **Reverting `delivered` → anything blocked by trigger `sales_orders_block_terminal_status_revert`** unless the UPDATE also sets `void_at` (via `void_sales_order`) and caller is owner (mig 131).
- **Failure modes**: any non-void status patch on a delivered row → `40000`. Non-owner trying to revert → `40000`.
- **Launch readiness**: PASS.

### W8. Sales-order void

- **Responsible role**: Owner only.
- **Path**: UI calls `void_sales_order(p_sales_order_id, p_reason)`. Single UPDATE sets `status='cancelled', void_at=now(), void_reason, void_by` — trigger 131 explicitly permits this combination.
- **Notifications**: `sale.voided` → sales_ops + owner (mig 128 added sales_ops).
- **Launch readiness**: PASS.

### W9. Sales-order: quote → deposit lifecycle

- **Responsible role**: Sales / Sales Ops.
- **Path**: UI sets `quote_sent_at` first; subsequent `deposit_paid_at` patch passes the `lifecycle_deposit_after_quote` CHECK (mig 132). Pre-existing rows backfilled.
- **Failure modes**: setting `deposit_paid_at` while `quote_sent_at IS NULL` → check_violation (`23514`). Verified via static test against the live constraint.
- **Launch readiness**: PASS.

### W10. Trade-in to sale commit

- **Responsible role**: Sales / Owner.
- **Path**:
  1. `/trade-ins/[id]/page.tsx` calls `commit_trade_in_to_sale(p_trade_in_id, p_sales_order_id)`.
  2. RPC verifies: caller has `sales` or owner; trade-in is `approved`; trade-in has `accepted_value`; **mig 130 — trade-in.customer_id MUST match sales_orders.customer_id**.
  3. Marks trade-in `committed`, links to sales order, emits `trade_in.committed`.
- **Failure modes**: mismatched customer → `40000`; not approved → exception; no accepted value → exception.
- **Launch readiness**: PASS. Function body contains the `customer_id IS DISTINCT FROM` guard (verified).

### W11. Refund request → approval → payout

- **Responsible role**: Garage / Cashier / Owner.
- **Path**:
  1. UI `/garage/refunds/[id]/page.tsx` calls `approve_refund` or `reject_refund`.
  2. RPC blocks the requester from approving their own refund (mig 120, errcode `42501`).
  3. Approval tier determined by `refunds.approval_required` — `owner` → must be `is_owner()`, otherwise `is_owner OR manage_team`.
  4. On payout: `mark_refund_paid` updates `status='paid'`; if `payment_method='cash'`, trigger `trg_refund_payment_to_cash_movement` writes a cash_movements row to the open session (mig 116).
- **Failure modes**: self-approve → `42501`; non-pending refund → exception; cash without session → trigger silently skips (refund flow chooses record-then-reconcile, per migration 116 note).
- **Launch readiness**: PASS.

### W12. PO lifecycle + GRN + payment

- **Responsible role**: Inventory / Owner; Cashier for payment.
- **Path**:
  1. PO created in draft → moved through approved/sent_to_supplier via existing RPCs.
  2. GRN: `/garage/purchase-orders/[id]/page.tsx` calls `record_purchase_order_receipt`. New behaviour: per-line over-receipt cap (mig 123) raises `40000`; on accepted good/extra lines, a `part_movements` `stock_in` row is written (mig 124).
  3. Invoice + payment: `purchase_order_payments` insert fires `trg_po_payment_to_cash_movement` (mig 117) which writes a cash_movements expense row on the open session.
- **Failure modes**: over-receipt blocked; payment without open session → silent skip on cash attach (logged but not blocked).
- **Launch readiness**: PASS. Function body confirmed to contain the over-receipt guard and the part_movements insert.

### W13. Warranty / recall / refund notifications

- **Responsible role**: System.
- **Path**: `emit_notification` dispatcher → reads `notification_event_rules` → fans out to roles/capabilities. Migration 128 adds:
  - sales_ops: `customer.created`, `test_drive.overdue_1h`, `sale.voided`, `trade_in.approved`, `trade_in.rejected`.
  - garage_staff: `task.assigned`, `garage_job.parts_arrived`, `service.due_soon`.
  - cashier: `cash.variance_over_threshold`.
- **Launch readiness**: PASS. Rules verified present.

### W14. Customer onboarding (notes + documents)

- **Responsible role**: Sales / Sales Ops / Assistant / Owner.
- **Path**: `/customers/add/page.tsx` creates customer row (gate matches RLS post-126). Notes / docs inserts use `customer_notes_insert` / `customer_documents_insert` policies — both now include `sales_ops`, `assistant`, and the `sales` capability.
- **Failure modes**: writer mismatch (uploaded_by ≠ auth.uid()) → RLS rejects.
- **Launch readiness**: PASS at row level. Object storage scoping pending mig 127.

### W15. Test drive booking / return

- **Responsible role**: Sales / Garage / Manage-team-cap / Owner.
- **Path**: `/test-drive/page.tsx` has real page gate now (`isOwner OR sales OR garage OR manage_team`). Real customer typeahead picker (PR #72). Server-side and client-side validation from mig 105 plus prior hotfix.
- **Failure modes**: duplicate active test drive per VIN blocked (mig 105 CHECK).
- **Launch readiness**: PASS.

### W16. Garage history page access

- **Responsible role**: Anyone who is owner/assistant/garage-manager/hybrid OR has approved page-access request (24-hr expiry).
- **Path**: `/garage/history` checks `getPageAccessStatus`; if pending/none, prompts a request that notifies owners.
- **Launch readiness**: PASS.

### W17. Approval thresholds editing

- **Responsible role**: Owner or `manage_team` capability.
- **Path**: `/settings/approval-thresholds/page.tsx` lists the four standard rows and UPDATEs `manager_floor` / `owner_floor`. CHECK `approval_thresholds_floors_ordered` rejects an UPDATE that sets `owner_floor < manager_floor`.
- **Launch readiness**: PASS. Confirmed via static violation test against live constraint.

---

## 5. What every employee should do on day 1

### Owner (Samer / Kareem)
Sign in. Open `/dashboard` and confirm the snapshot is loading. Visit `/settings/approval-thresholds` and confirm the four rows (refund, estimate, parts_order, goodwill) are present at the defaults you want; nudge if your manager-floor expectations differ. Open `/cash`, start the day's drawer with `Open session` and the opening float; verify the business_date stamps as today (Beirut). If a refund is already pending you've requested, ask the other owner to approve — you cannot self-approve. Don't deactivate the other owner; the trigger will block you anyway, but please don't try.

### Garage Manager (Mark)
Sign in. Open `/garage`. New jobs from this morning's arrivals should be present (auto-created on arrival). Triage them and assign to Suhail. For any case that becomes a warranty issue, open `/garage/warranty` → "New case" → drive it through `open → investigating → in_repair → completed`. Use `/garage/recalls` only when an OEM recall lands. POs only if you've been granted the inventory capability — today you have not; route parts requests through an owner.

### Garage Staff (Suhail)
Sign in. Open `/garage` — only jobs assigned to you matter (the UI filters; the DB also enforces this). Move your job between status states, log time entries (one open at a time — the DB enforces this), and use `/garage/inventory` to pull parts onto a job. If you need to mark a part used, that flows through `apply_part_to_job` and decrements stock atomically. You cannot create new garage jobs; ask Mark.

### Sales (when role is granted — currently no users)
Sign in. Open `/cars` to inventory-shop with the customer, `/test-drive` to start a test drive on a scanned VIN, `/customers/add` to create a customer record. Once they want to buy: `/sales-orders` → create → send the **quote first** (the DB will block recording a deposit until the quote is sent — `lifecycle_deposit_after_quote`). For trade-ins use `/trade-ins`; once approved you can commit to the sale, but the customers on the trade-in and the sale must match — the DB will block a mismatch.

### Assistant (Lara / Samaya)
Sign in. Open `/assistant-dashboard`. Triage requests. Help intake new customers via `/customers/add` (you have RLS access post-126). With your `cashier` capability you can open the cash session if the owner is away; you can also mark installment payments paid via `/installments`. Watch out for "no open cash session" errors when recording cash payments — open `/cash` first.

### Cashier (capability) — Lara / Samaya / Kareem
Open the day with `Open session` on `/cash`, opening balance entered. Every payment-method=cash refund (`/garage/refunds`) and PO payment (`/garage/purchase-orders/.../invoices`) will auto-show in your cash movements list. Installment cash payments require the session to be open — they hard-fail otherwise. At end of day, click **Close session**, enter the actual count; if you're more than the variance threshold off, you'll get a `cash.variance_over_threshold` notification — the owner sees it too.

### Hybrid (Khalil)
Sign in. You see the assistant dashboard, garage, customers, trade-ins, data-health, and parts. You can place trade-ins through to commit because you have the `sales` capability. You can read/edit parts via the parts CRUD permission. Reports nav is hidden until/unless an owner grants you `view_reports` or `manage_team`. Cash is not available unless `cashier` is added.

---

## 6. Remaining Known Limitations (post-launch backlog)

- **`job-documents` storage scoping is role-gated, not folder-gated.** Migration 127 deliberately leaves this less tight than `customer-documents` because the warranty upload path uses `warranty/{id}/...` instead of `{job_id}/...`. P0 follow-up: unify the prefix and tighten the policy.
- **/sales-orders page UI gate is narrower than `PAGE_PERMISSIONS`.** The page hard-codes `owner | assistant | sales_ops`; `sales` and `hybrid` cannot reach it via the URL even though `permissions.ts` would allow them. No live user holds bare `sales` today, so it does not bite — but it is dead code drift. Clean up before granting the `sales` role to a real user.
- **`khalil_hybrid` is a TS-only alias.** The DB enum is `hybrid`. The aliasing is internal to the UI; if a developer reads `khalil_hybrid` literally and writes it to the DB they'll get an enum violation. (`/lib/permissions.ts` and `/lib/contexts/UserContext.tsx` treat them as equivalent at the React layer.)
- **Refund cash-out trigger is silent on no-session.** Migration 116 chose record-then-reconcile rather than blocking. Operationally fine, but cashiers should know the cash_movements row will simply not exist until they backfill.
- **`commit_trade_in_to_sale` requires the `sales` capability**, not the `sales_ops` role. If you grant a pure-sales_ops user trade-in commit rights without giving them the capability, the RPC will reject. Today no one is in this state.
- **Security-definer views (8) and authenticated-executable definer-function warnings (68/10/4)** remain flagged by the advisor. They are pre-existing and unrelated to this sprint; they should be reviewed in a dedicated hardening pass but do not block launch.
- **Reports nav hides for users without `view_reports` / `manage_team` capability** — by design, but the UX is "the link disappears" rather than "access denied page" which can confuse staff during onboarding.

---

## 7. Launch Checklist (manual steps before flipping the switch)

| # | Step | How |
|---|------|-----|
| 1 | **Apply migration 127 via Supabase Dashboard SQL editor.** The MCP runner cannot escalate to `supabase_storage_admin`. Paste `supabase/migrations/127_storage_doc_policies_scoped.sql` into the Dashboard SQL editor and run. Verify by re-running `SELECT polname FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname LIKE '%docs_%scoped%'` — four rows must come back. | Dashboard SQL |
| 2 | **Verify owner accounts are exactly 2 (Samer + Kareem) before deactivating any owner.** Confirmed live as of this audit (`SELECT count(*) FROM profiles WHERE user_role='owner' AND is_active=true` → 2). Re-run before any production change to a profile. | psql / Dashboard |
| 3 | **Smoke-test cash session open + close in Asia/Beirut TZ.** Open `/cash`, click `Open session` with float = $0, immediately check `business_date` in the row — must be today's Beirut date (verified via static insert+rollback as `2026-05-19` at audit time). Then close with closing actual = $0 → variance = 0 → status flips to `closed`. | UI |
| 4 | **Smoke-test `create_payment_plan` end-to-end with a cash down payment.** Pick a customer + car, total $5,000, down $1,000 cash, 4 monthlies of $1,000. With the cash session open, expect: plan created, 5 `installment_payments` rows, the first one `paid` and a `cash_movements` row of $1,000. Without the session open, expect a `40000` error on the down-payment leg (mig 119). | UI |
| 5 | **Smoke-test complete workflow A (intake → garage → handover).** Use a test VIN. Confirm: request created → garage_job auto-created → assignable → time entry can be logged → completion flips `cars.location`. | UI |
| 6 | **Smoke-test complete workflow B (test-drive booking → return).** Scan/enter a test VIN; verify the customer typeahead picker (PR #72) works; start, then finish; expect exactly one active test drive at a time per vehicle (mig 105). | UI |

The launch is gated by step 1 only. Steps 2 – 6 are pre-flight sanity, not blockers — they will surface any regression but the static checks already passed.

---

## 8. Smoke-test Results

| # | Workflow | Mode | Result |
|---|----------|------|--------|
| 1 | W1 Intake → Garage → Handover | static (page + RLS) | PASS — page `/garage/page.tsx` uses RLS-compatible calls; garage_staff INSERT is correctly absent from `garage_jobs_insert_access`; UPDATE WITH CHECK pins `assigned_to = auth.uid()` for staff. |
| 2 | W2 Warranty case lifecycle | static (page + RPC) | PASS — RPC `set_warranty_case_status(uuid, text, text)` present; page caller uses 3-arg shape. |
| 3 | W3 Recall lifecycle | static | PASS — RPC `set_recall_status(uuid, text)` matches page. |
| 4 | W4 Use part on job | static | PASS — `use_part_on_job` and `apply_part_to_job` both have `FOR UPDATE` + `Insufficient stock` guards. |
| 5 | W5 Payment plan + down payment | static | PASS — page calls `create_payment_plan` with 12 args; RPC signature matches; `apply_installment_payment` body contains the no-cash-session guard. |
| 6 | W6 Cash session open / close | live BEGIN/ROLLBACK | PASS — inserted into `cash_sessions` with default; `business_date='2026-05-19'` matched expected Beirut date. |
| 7 | W7 Sales-order delivery | static | PASS — trigger `trg_sales_orders_block_terminal_status_revert` live; body contains "delivered is terminal" and the void-path bypass. |
| 8 | W8 Sales-order void | static | PASS — trigger permits the void path (status=cancelled + void_at set in same UPDATE). |
| 9 | W9 Deposit-after-quote | live BEGIN/ROLLBACK | PASS — INSERT with `deposit_paid_at NOT NULL` and `quote_sent_at IS NULL` raised `check_violation`. |
| 10 | W10 Trade-in commit customer match | static | PASS — function body contains `customer_id IS DISTINCT FROM` guard. |
| 11 | W11 Refund self-approve block | static | PASS — `approve_refund` and `reject_refund` both contain the self-approve guard. |
| 12 | W12 GRN over-receipt + part_movements | static | PASS — `record_purchase_order_receipt` body contains over-receipt cap and `INSERT INTO public.part_movements ... stock_in`. |
| 13 | W13 Notification rules | live SELECT | PASS — 11 new rules confirmed (5 sales_ops, 3 garage_staff, 3 cashier-cap). |
| 14 | W14 Customer notes/docs RLS | live policy inspection | PASS — `customer_notes_insert`, `customer_notes_update`, `customer_documents_insert`, `customer_documents_update` policies include `sales_ops`, `assistant`, and `sales` capability. |
| 15 | W15 Test drive page gate | static | PASS — `/test-drive/page.tsx` has `allowed = isOwner OR sales-cap OR garage-cap OR manage_team-cap` and a friendly "No access" panel below. |
| 16 | W16 Garage history page-access | static | PASS — `page-access.ts` flow uses `getPageAccessStatus` and `requestPageAccess` correctly. |
| 17 | W17 Approval thresholds CHECK | live BEGIN/ROLLBACK | PASS — UPDATE setting `owner_floor=0` on the `refund` row raised `check_violation` on `approval_thresholds_floors_ordered`. |

Additional DB-side smoke tests executed (read-only, wrapped in BEGIN/ROLLBACK or DO blocks):

| Test | Result |
|------|--------|
| Last-owner self-demote: UPDATE both active owners to `is_active=false` | RAISED `40000 Cannot demote, deactivate, or delete the last active owner` — PASS |
| `cash_sessions.business_date` default expression | `((now() AT TIME ZONE 'Asia/Beirut'::text))::date` — PASS |
| Migration 127 application status | NOT applied — `Auth users can upload/view customer documents` and `Auth users can upload/view job documents` still present. **This is the single open manual step.** |
| Approval thresholds seed | 4 rows present at expected values — PASS |
| Notification rules for sales_ops / garage_staff / cashier | 11 rules present — PASS |
| Critical RPC presence | 16 of 16 expected RPCs found — PASS |
| Critical trigger presence | 5 of 5 expected triggers found — PASS |
| Sales-order CHECK `lifecycle_deposit_after_quote` | live, definition `((deposit_paid_at IS NULL) OR (quote_sent_at IS NOT NULL))` — PASS |
| Approval-thresholds CHECK | live, definition `(owner_floor >= manager_floor)` (name: `approval_thresholds_floors_ordered`; mig 129 noticed the equivalent and skipped re-adding) — PASS |
| garage_jobs RLS | INSERT correctly excludes garage_staff; UPDATE includes the `assigned_to = auth.uid()` clause for garage_staff — PASS |

---

**Launch ready with 1 manual step — apply migration 127 via the Supabase Dashboard SQL editor, then go.**
