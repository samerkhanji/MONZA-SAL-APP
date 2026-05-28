# Garage workflow audit — 2026-05-28 — HEAD 460997f

Scope: every `web/src/app/(dashboard)/garage/**`, `web/src/components/garage/**`,
`web/src/lib/garage-bays.ts`, and every `supabase/migrations/*` touching
garage_jobs, job_parts, job_time_entries, garage_tasks, repair_proposals,
purchase_orders, warranty_cases, recalls, refunds.

Sub-flows reviewed:

| Sub-flow | Pages | Key tables | Status |
|---|---|---|---|
| Garage jobs (intake → in_progress → done → delivered → cancelled) | `garage/page.tsx`, `garage/jobs/[id]/page.tsx`, `garage/history/page.tsx` | `garage_jobs` | BROKEN — see 🔴 #1 |
| Job intake / category fan-out | `SetJobCategoryDialog`, RPC `set_garage_job_category` | `task_categories`, `task_routing_rules`, `tasks` | OK |
| Garage tasks board | `garage/tasks/page.tsx` (uses `garage_tasks`, not `tasks`) | `garage_tasks` | OK, but two parallel task systems exist (see 🟡 #1) |
| Job time entries (clock in/pause) | `JobTimeEntryControls` | `job_time_entries`, `garage_jobs.actual_hours` | OK |
| Time reports | `garage/time-reports/page.tsx` | `job_time_entries` | OK |
| Parts on jobs (add / return) | `garage/jobs/[id]/page.tsx`, `NewJobDialog` | `job_parts`, `parts`, `part_movements` | OK — two RPCs for the same purpose (`apply_part_to_job` from detail page, `use_part_on_job` from new-job dialog) — see 🟡 #2 |
| Repair proposals | `RepairProposalPanel` | `repair_proposals`, `repair_proposal_items` | OK |
| Purchase orders | `garage/purchase-orders/**` | `purchase_orders`, `purchase_order_lines`, `*_receipts`, `*_invoices`, `*_payments` | OK |
| Warranty cases | `garage/warranty/**` | `warranty_cases`, `warranty_case_parts`, `warranty_case_documents` | OK (one minor link-degrade — see 🟡 #3) |
| Recalls (campaign tracking) | `garage/recalls/**` | `recalls`, `recall_vehicles` | OK |
| Refunds | `garage/refunds/**` | `refunds` | OK |
| Bays | `GarageBaySection`, `JobBayTypeControls` | `garage_bays`, `garage_job_bay_context` | OK |
| Inventory / suppliers / efficiency | `garage/inventory/page.tsx`, `garage/suppliers/page.tsx`, `garage/efficiency/page.tsx` | `parts`, `suppliers`, view: `garage_*_efficiency` | OK |

---

## 🔴 Broken (visibly fails or silently corrupts data)

### 🔴 1. `garage_jobs.started_at` is NOT NULL, but three code paths UPDATE it to NULL — every "Finish job" and "Cancel job" write fails at the DB.

**File / lines:**
- `web/src/app/(dashboard)/garage/page.tsx:334` — `updates.started_at = null;` on "done"
- `web/src/app/(dashboard)/garage/page.tsx:338` — `updates.started_at = null;` on "cancelled"
- `web/src/components/garage/FinishJobDialog.tsx:125` — `started_at: null` on completion

**Why it's broken:**
- Generated DB types (`web/src/lib/supabase/database.types.ts:2230`) show `started_at: string` on `Row` (NOT NULL), with optional `started_at?: string` on `Insert` (DEFAULT exists), and optional on `Update`. NULL is rejected by the column.
- Migration history confirms: `started_at` was renamed from `opened_at` (archive `20260424075722_garage_jobs_align_columns_to_code.sql`) and the original `opened_at` column in archive `20260420135100_create_missing_tables_20260420.sql` had a NOT NULL DEFAULT now() constraint that was preserved through the rename. No subsequent migration loosened it.
- The contradictory design intent is captured in `JobTimeEntryControls.tsx:222–224`: *"Don't null garage_jobs.started_at on pause — the original start time is preserved across pauses."* Yet the same value is wiped on Finish/Cancel. There is no reason to wipe it: history/efficiency views (`garage_job_efficiency`, `091_owner_reports_views.sql:170-175`) explicitly use `started_at IS NOT NULL` to compute job duration, so wiping it on Done would actively break those reports if the write succeeded.

**Why this isn't already exploding for every user:**
Two things mask the breakage:
1. The Done/Cancel path also tries to `garage_bay_id = null` and other writes in the same UPDATE — Supabase returns a single error, the toast shows it, the user sees "violates not-null constraint", but no one wired a clean error message and devs may have assumed it was a permission issue.
2. The page falls through to `fetchJobs()` regardless and the UI re-renders the unchanged job, so a casual operator just sees "nothing happened" and clicks Finish again with the same result.

**PR #151 context:**
PR #151 noticed this NOT NULL constraint and proposed a workaround. The proper fix is to **stop writing `started_at: null`** — the column is correct (it's the canonical "first work started" timestamp). The reports rely on it.

**Repro steps:**
1. Open `/garage`. Find any pending job. Click Start → status becomes `in_progress`, `started_at` is set.
2. Click Finish → submit dialog → DB rejects the UPDATE with `null value in column "started_at" of relation "garage_jobs" violates not-null constraint`.
3. The toast shows the DB error; the job stays `in_progress`. Same for using the status dropdown to Cancelled.

**Proposed fix (safe to ship, applied in fix PR):** delete those three lines. The column already preserves the original start time; that's what the reports want. Bay release is unaffected — `garage_bay_id = null` stays.

### 🔴 2. `JOB_STATUS_TRANSITIONS` is missing the DB-allowed `open` and `ready` statuses — any job that lands in one of those (from a migration backfill, an admin SQL fix, or a future RPC) becomes a permanent dead end in the UI.

**File / lines:**
- `web/src/lib/constants/jobs.ts:35–42` — only knows `pending → in_progress → waiting_parts → done → delivered/cancelled`
- DB check constraint per migration `089_auto_create_garage_job_on_arrival.sql:14–23` accepts `'open'` and `'ready'`
- `garage/page.tsx:83` `VALID_JOB_STATUSES` also omits `open` and `ready`

**Effect:** a job with `status='open'` (e.g. from any future RPC, or a row migrated from an older flow) renders as the raw string "open" in the dropdown, the Status select has no transitions to offer (because `JOB_STATUS_TRANSITIONS['open']` is undefined → `?? []` → `[]`), and the operator cannot move it forward. Same for `ready`.

**Proposed fix (needs user decision):** either
- (a) **Tighten the DB:** drop `'open'` and `'ready'` from the CHECK constraint after a one-shot UPDATE of any extant rows (`UPDATE garage_jobs SET status='pending' WHERE status='open'; UPDATE garage_jobs SET status='done' WHERE status='ready';`), or
- (b) **Widen the FE:** add `open` and `ready` to `JOB_STATUS_LABELS` and `JOB_STATUS_TRANSITIONS`.

Right now there's no data in those statuses (no codepath writes them), so the bug is latent. **Flagging for user decision** — don't ship a fix without picking (a) or (b).

---

## 🟡 Half-finished (UI exists, code is partial)

### 🟡 1. Two parallel garage task systems — `tasks` (set up by `set_garage_job_category`) and `garage_tasks` (used by `garage/tasks/page.tsx`).

**Files:**
- `supabase/migrations/090_garage_job_intake_fan_out.sql:171` — `set_garage_job_category` INSERTs into `public.tasks`
- `web/src/app/(dashboard)/garage/tasks/page.tsx:37` — board queries `garage_tasks`
- `supabase/migrations/_archive/043_garage_workflow_tasks_timers_capacities.sql:33` — `garage_tasks` table

**Effect:** when the receiver picks an intake category, fan-out tasks land in `public.tasks` (with assignees + due dates), but **the Garage Task Board (`/garage/tasks`) reads `garage_tasks`** and never sees them. The tasks show up in user notifications, but the dedicated tasks page is empty unless someone explicitly creates a checklist from a template (the only path that writes to `garage_tasks`).

This is "half-built" — the intake fan-out exists and works, but the place users would look for those tasks (the task board) shows nothing related. Tasks created via the intake fan-out only surface in personal notifications + the `tasks` table (no UI in `garage/`).

**Needs user decision: pick one model.**
- (a) Migrate `garage_tasks` board to read from `tasks` (filter `source_type='garage_job'`).
- (b) Have `set_garage_job_category` also INSERT into `garage_tasks` so both views stay in sync.
- (c) Leave it — accept that the task board is for "template-checklists per car" while intake tasks are personal-todos surfaced in notifications only.

### 🟡 2. Two RPCs do the same job-uses-part operation: `apply_part_to_job` and `use_part_on_job`.

**Files:**
- `web/src/app/(dashboard)/garage/jobs/[id]/page.tsx:223` — uses `apply_part_to_job`
- `web/src/components/garage/NewJobDialog.tsx:282` — uses `use_part_on_job`
- Migration `148_use_part_on_job_cost_snapshot.sql` explicitly says it was rewritten to match `apply_part_to_job`'s cost-snapshot behavior because the two had diverged.

**Effect:** redundancy + risk that one drifts from the other again. Migration 148 fixed a real prior bug: parts attached during job creation got no cost snapshot, so subsequent unit_cost edits silently changed the job's cost retroactively. Both RPCs are now equivalent — but the redundancy is fragile.

**Proposed fix (needs user decision):** drop `use_part_on_job` and have `NewJobDialog` call `apply_part_to_job`. Risk: any other caller (cron, SQL script, third-party MCP) that imports `use_part_on_job` would break. **Flagging for user decision** — needs a quick `grep` outside this codebase before deletion.

### 🟡 3. Deep-link from warranty case to refund silently degrades if the case has no customer.

**File / lines:**
- `web/src/app/(dashboard)/garage/warranty/[id]/page.tsx:425` — `?warranty_case=${wc.id}&customer=${wc.customer_id ?? ""}`
- `web/src/app/(dashboard)/garage/refunds/page.tsx:120-128` — consumes both params
- `CreateRefundDialog` uses `initialCustomerId ?? ""` — empty string ≠ preselection, so the customer-required field becomes mandatory manual entry

**Effect:** if `customer_id` is NULL on the warranty case (the warranty_cases.customer_id is nullable per `099_warranty_recall_refunds.sql:47`), the "Issue refund tied to this case" button opens the refund dialog with `warranty_case_id` pre-filled but no customer. The user has to pick a customer manually — but refunds always REQUIRE a customer (refunds.customer_id is NOT NULL). The link is half-working but never advertised to the user.

**Proposed fix (safe to ship, applied in fix PR):** when `wc.customer_id` is null, suppress the "Issue refund tied to this case" button and surface a tooltip ("Link a customer to this case to issue a tied refund"). Going with this is simpler and surfaces the underlying data gap.

---

## 🟢 Dead / placeholder (never wired up; either delete or finish)

### 🟢 1. `JOB_STATUS_TRANSITIONS` has empty `delivered: []` and `cancelled: []` — terminal states, intended. Not dead code, just terminal. **Keep.**

### 🟢 2. `garage_jobs` DB CHECK accepts `'open'` and `'ready'` but no FE codepath writes them, no migration RPC writes them, no fan-out trigger writes them. They were carried over from a legacy lifecycle. **Already flagged in 🔴 #2 — folded in.**

### 🟢 3. `move_part_stock` RPC is called from FE (`StockMovementDialog.tsx:111`) and from other RPCs (`148_use_part_on_job_cost_snapshot.sql:51`, `125_unify_use_part_on_job_stock_check.sql:46`) but no checked-in migration defines it. It must have been created via the Supabase dashboard at some point and never backfilled. **Not broken — but the migration drift means a fresh `supabase db reset` would fail.** Out of scope for this audit; flagging here so it isn't forgotten.

### 🟢 4. `CarStatus` TS type (`web/src/types/database.ts:2`) lists 5 enum values, but `car_status` Postgres enum (`_archive/001_car_inventory.sql:20`) has at least 8: `inbound, inventory, in_stock, showroom, reserved, sold, delivered, service`. Pages that compare `car.status === 'service'` work at runtime but TypeScript can't catch typos. **Not dead — TS type is just stale.** Out of scope.

---

## Fix plan

### 🔴 Fixes shipped in PR #1 (safe, narrowly scoped)
- Delete the three `started_at: null` writes (`garage/page.tsx`, `FinishJobDialog.tsx`).
- Hide the "Issue refund tied to this case" button when `wc.customer_id` is null, with a hint explaining why (🟡 #3).

### Deliberately NOT shipped
- 🔴 #2 (latent `open`/`ready` statuses) — needs user decision on tighten-DB vs widen-FE.
- 🟡 #1 (two task systems) — needs product decision on which one is canonical.
- 🟡 #2 (two parts-on-job RPCs) — needs grep outside this codebase before dropping.
- 🟢 #3 (`move_part_stock` migration drift) — out of scope, separate cleanup PR.
- 🟢 #4 (CarStatus TS type stale) — out of scope.

---

## Top-3 items the user should manually QA after merging PR #1

1. **Finish a job from the list view** (`/garage`). Click the Finish button on an in-progress job, fill the dialog, submit. The job should move to Done and the toast should say "Job completed" — not a DB error.
2. **Cancel an in-progress job via the status dropdown.** Select Cancelled. The confirmation modal should appear, then the job moves to Cancelled. No DB error.
3. **Click "Issue refund tied to this case" on a warranty case with NO linked customer.** The button should not appear (a hint appears instead). Then link a customer to the case via the database (set `warranty_cases.customer_id`), refresh — button reappears and the deep-link now pre-fills the customer in the refund dialog.
