# Data quality audit — 2026-05-26
Project: `okxpsvukzjjubinhamek` (MONZA-SAL-APP, live)

Scope: read-only SQL audit via Supabase MCP. No migrations applied, no data mutated.

Snapshot of major tables at audit time:
- `cars`: 185 rows (incl. soft-deleted)
- `customers`: 185
- `sales_orders`: 120
- `profiles`: 8
- `car_events`: 154
- `garage_jobs`: 1
- `car_warranties`: 185

---

## Findings (grouped by severity)

### 🔴 Critical

#### 1. 100% of `sales_orders` are missing pricing data
- Affected rows: **120 / 120** (every sales order — 119 confirmed + 1 delivered)
- Specifically:
  - `selling_price IS NULL`: 120
  - `quote_amount IS NULL`: 120 of 119 confirmed
  - `deposit_amount IS NULL`: 120 of 119 confirmed
  - `sale_date IS NULL`: 119 of 119 confirmed
  - `delivered_at IS NULL`: 119 of 119 confirmed (only `delivery_date` set on 1 row)
- Sample IDs: `07a445e0-bf88-41b8-9f8a-988514559969`, `1b162027-59f2-48d7-a997-c01160233a45`, `5b1955a7-abc7-4d19-b0c6-e7da60d1079d`, `43b0d6e0-0cad-4889-a512-c4a4eb3b2fa1`, `36db2cf8-fb59-4dea-ba72-065f006a8bb6`
- SQL:
  ```sql
  SELECT SUM((selling_price IS NULL)::int), SUM((quote_amount IS NULL)::int),
         SUM((sale_date IS NULL)::int), COUNT(*)
  FROM sales_orders WHERE status::text = 'confirmed';
  ```
- Recommended action: This appears to be a bulk-import artifact (every record came in shaped the same way). Business owner needs to either (a) back-fill prices/dates from the source-of-truth (DMS export, contracts, deposit receipts), or (b) explicitly mark these as `legacy_import` so future reporting/commission/tax queries don't silently produce zeros. **Do not** enforce a `NOT NULL` constraint until backfill is complete.

#### 2. `sales_orders.created_by` missing on 98% of rows
- Affected rows: **118 / 120**
- Sample IDs: `07a445e0-bf88-41b8-9f8a-988514559969`, `1b162027-59f2-48d7-a997-c01160233a45`, `5b1955a7-abc7-4d19-b0c6-e7da60d1079d`, `43b0d6e0-0cad-4889-a512-c4a4eb3b2fa1`, `36db2cf8-fb59-4dea-ba72-065f006a8bb6`
- SQL: `SELECT COUNT(*) FROM sales_orders WHERE created_by IS NULL;`
- Recommended action: Audit trail / commission attribution will be impossible. Either backfill from DMS export, or mark imported rows by assigning the import-bot owner profile (e.g. `efc672c8-…`). Add a check constraint or trigger to require `created_by` on new rows.

#### 3. `cars.created_by` missing on 99% of rows
- Affected rows: **184 / 185** (only one car has a tracked creator)
- Sample IDs: `326757a3-d272-410d-be41-e4b946e30fea`, `7a789720-5fcb-4fe2-8c6f-c2f07490fd49`, `49116a5c-72ef-4706-b0c8-4bf79ca37094`, `cdee7586-056c-4b03-bbf2-1386a1131f29`, `7a968055-d99b-4325-8988-01e3aebc131d`
- SQL: `SELECT COUNT(*) FROM cars WHERE created_by IS NULL AND deleted_at IS NULL;`
- Recommended action: Same as #2 — backfill or attribute to import-bot profile, then enforce non-null going forward.

---

### 🟠 High

#### 4. 80% of "sold" cars have no `sold_at` timestamp
- Affected rows: **95 / 120 cars** with status in (`sold`,`delivered`)
- Sample IDs: `7a789720-5fcb-4fe2-8c6f-c2f07490fd49`, `cdee7586-056c-4b03-bbf2-1386a1131f29`, `7a968055-d99b-4325-8988-01e3aebc131d`, `7cb57e0f-4122-4e1e-9a08-7e35d7bfdcbc`, `47b07b42-3ad6-4153-a8b3-52a541fb8088`
- SQL: `SELECT COUNT(*) FROM cars WHERE status::text IN ('sold','delivered') AND sold_at IS NULL AND deleted_at IS NULL;`
- Recommended action: Make `cars.sold_at` populated automatically by trigger when `status` transitions into `sold`/`delivered`. Backfill historical rows from `sales_orders.sale_date` / `delivered_at` once those are also backfilled (linked to finding #1).

#### 5. `cars` uses two legacy status values not in the active workflow
- `inventory`: **46 rows** (most recent update 2026-05-21 — still being touched)
- `available`: **17 rows**
- These coexist with the modern `in_stock` workflow (which currently has **0** rows). Combined: 63 rows / 184 active cars are on a parallel status track.
- Sample IDs (inventory): query `SELECT id FROM cars WHERE status::text = 'inventory' AND deleted_at IS NULL LIMIT 5;`
- SQL:
  ```sql
  SELECT status::text, COUNT(*) FROM cars WHERE deleted_at IS NULL GROUP BY status;
  ```
- Recommended action: Decide whether `inventory`/`available` are part of the canonical state machine. If they are, document the transitions; if they are legacy from the imported DMS data, run a migration to map them to `in_stock`/`showroom`/etc and remove from the enum (the values were added in early migration `058_cars_scrapped_enum_value` and never reconciled).

#### 6. 90% of sold/delivered cars still show `pdi_status = 'pending'`
- Affected rows: **108 / 120** cars with status `sold`/`delivered` are still PDI pending
- Total `pdi_status = 'pending'`: **144 / 184**, including:
  - 107 with `status='sold'`
  - 29 with `status='inventory'`
  - 6 with `status='available'`
  - 1 with `status='service'`, 1 with `status='delivered'`
- SQL:
  ```sql
  SELECT pdi_status::text, status::text, COUNT(*) FROM cars WHERE deleted_at IS NULL GROUP BY 1,2;
  ```
- Recommended action: PDI should be completed before sale by policy. Either (a) backfill `pdi_status='done'` for cars that were already delivered to customers (likely the case for the imported set), or (b) generate work-orders/garage_jobs to perform PDI on the remaining vehicles. Add a guard to prevent transitioning a car to `sold` while `pdi_status='pending'`.

#### 7. Cron job timeouts (transient but worth tracking)
- Jobs `detect-overdue-test-drives` (id 4) and `wake-snoozed-notifications` (id 7) both failed once on 2026-05-25 11:00 UTC with `job startup timeout`. All other runs succeeded. No other failures in past 7 days.
- SQL: `SELECT * FROM cron.job_run_details WHERE status != 'succeeded' ORDER BY start_time DESC LIMIT 10;`
- Recommended action: Add basic alerting on `cron.job_run_details.status != 'succeeded'`. Investigate co-occurring failures (both jobs failed at exactly the same minute → likely platform-side cron worker hiccup).

---

### 🟡 Medium

#### 8. Customers with no contact info
- `email IS NULL`: **177 / 185** (96%)
- `phone_primary IS NULL`: **106 / 185** (57%)
- SQL: `SELECT COUNT(*) FROM customers WHERE email IS NULL OR email = '';`
- Recommended action: For lead-stage records, missing email is expected. But for the 116 customers with `lead_status='converted'` who completed a purchase, missing contact info will block warranty / recall outreach. Generate a one-time CSV report of converted customers missing email/phone for the sales team to back-fill.

#### 9. Sales order references a soft-deleted customer
- Affected rows: **1**
- Sample ID: `9442585f-fb47-4d79-9315-a2748e5ed230` (status=`confirmed`, customer was deleted 2026-03-03 but the sales order was last updated 2026-05-25)
- SQL:
  ```sql
  SELECT so.id FROM sales_orders so
  JOIN customers cu ON cu.id = so.customer_id
  WHERE cu.deleted_at IS NOT NULL;
  ```
- Recommended action: Either restore (un-delete) the customer if the order is legitimate, or void the sales order. Add a trigger to prevent customer soft-delete while active (non-void) sales orders reference them.

#### 10. Capability schema drift — `capabilities` array vs `capabilities_jsonb`
- The DB carries two parallel capability representations on `profiles` and they are not in lock-step:
  - One owner profile (`73413c72-061d-48e7-b9ea-3ef2e3c86486`) has `capabilities_jsonb = '{}'` while the array shows the full owner capability set — this user has no jsonb-based capabilities at all.
  - The `capabilities` array uses domain tokens (`garage`, `sales`, `inventory`, `data_health`); `capabilities_jsonb` uses action+resource keys (`view_sales`, `edit_garage`, `view_data_health`). They are clearly **two different vocabularies** rather than a 1:1 mapping. Whichever check runs on which path will give divergent answers.
- SQL:
  ```sql
  SELECT id, capabilities, capabilities_jsonb FROM profiles
  WHERE capabilities_jsonb = '{}'::jsonb;
  ```
- Recommended action: Pick a single source of truth and migrate consumers. Backfill the owner with the missing jsonb. Document the mapping or, preferably, drop the duplicate column.

#### 11. Cars marked sold without reservation_date or delivery_date
- Affected rows: **20** cars with `status IN ('sold','delivered')` and both `reservation_date IS NULL` AND `delivery_date IS NULL`
- SQL:
  ```sql
  SELECT COUNT(*) FROM cars
  WHERE status::text IN ('sold','delivered') AND reservation_date IS NULL
    AND delivery_date IS NULL AND deleted_at IS NULL;
  ```
- Recommended action: These cars have no traceable transaction date. Cross-check with the `sales_orders` rows for the same `car_id` and back-fill from there.

---

### 🟢 Low

#### 12. Tables with no foreign key constraints (where one is expected)
- `service_day_notifications_sent.job_id` references nothing — should FK to `garage_jobs(id)`.
- `cash_drawers`, `cash_settings`, `cash_sessions` have no FKs at all (consider FK to `profiles` for owner/operator if applicable).
- Other tables in the no-FK list that are legitimate (lookup / config): `approval_thresholds`, `garage_bays`, `notification_event_rules`, `service_intervals`, `system_events`, `task_categories`.
- SQL:
  ```sql
  SELECT t.table_name FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                    WHERE tc.table_schema='public' AND tc.table_name=t.table_name
                      AND tc.constraint_type='FOREIGN KEY');
  ```
- Recommended action: Add FK to `service_day_notifications_sent.job_id` → `garage_jobs(id) ON DELETE CASCADE`. Audit the cash-* tables once cashier flows are wired up.

#### 13. Supabase advisors — informational
- Security advisor: 58 `authenticated_security_definer_function_executable` warnings (signed-in users can execute SECURITY DEFINER functions). Review whether each function is intentionally exposed.
- Performance advisor:
  - 63 `unused_index` (INFO)
  - 54 `unindexed_foreign_keys` (INFO)
  - 17 `multiple_permissive_policies` (WARN) — overlapping RLS policies cause unnecessary policy evaluation
  - 3 `auth_rls_initplan` (WARN) — RLS using `auth.uid()` without subquery wrapper, prevents initplan caching
- Recommended action: Address the 17 `multiple_permissive_policies` (combine policies) and the 3 `auth_rls_initplan` warnings — both are hot-path RLS perf wins.

---

### ✅ Clean

The following audits returned zero issues:

1. **Cars with empty/NULL VIN**: 0 (`NOT NULL` constraint holds, no empties)
2. **Duplicate VINs (active or any)**: 0
3. **VIN format violations** (not 17 chars or non-alphanumeric): 0
4. **Sales orders with NULL `car_id` / `customer_id` / `status`**: 0 each
5. **Sales orders pointing to non-existent cars or customers (FK orphans)**: 0
6. **Sales orders pointing to soft-deleted cars**: 0
7. **Sales orders with VIN mismatching their car**: 0
8. **`garage_jobs.car_id` orphans / soft-deleted parents**: 0 (1 garage job total, intact)
9. **`car_events.car_id` orphans**: 0
10. **`cars.customer_id` orphans**: 0
11. **`car_warranties.car_id` orphans**: 0
12. **Sales orders / cars / customers / car_events `created_by` pointing to non-existent profile**: 0
13. **Notifications / push_subscriptions `user_id` orphans**: 0
14. **Cars with `status='in_stock' AND deleted_at IS NOT NULL`**: 0 (no contradiction)
15. **Cars with `status='sold'` and no customer_id**: 0
16. **Profile rows with no matching `auth.users` entry**: 0
17. **NULLs in `profiles.user_role` / `email` / `full_name`**: 0
18. **Inactive/terminated profiles still flagged `is_active=true`**: 0
19. **Stale sales orders (draft >90d, reserved >90d)**: 0
20. **Stale garage jobs (open >30d)**: 0
21. **Test drives scheduled in the past, not closed**: 0 (table empty)
22. **Cars `status='reserved'` without matching active sales order**: 0
23. **Customer duplicates by email / phone / name**: 0
24. **Currency consistency post-migration 158**: All 5 currency columns across `cars` and `sales_orders` are **100% USD**, no legacy AED/EUR residue.
25. **Tables without RLS enabled**: 0 (every public table has RLS enabled)
26. **RLS policies with both `qual` and `with_check` NULL**: 0 (no fully open policies)
27. **Tables with RLS enabled but no policies attached**: 0
28. **Cron jobs failing repeatedly**: 0 (1 transient failure on 2026-05-25 across 2 jobs, otherwise all green)
29. **`job_time_entries` orphans**: 0

---

## Summary

- 🔴 **3** critical findings (all related to the bulk-imported sales-orders / cars set lacking pricing, attribution, and timestamps)
- 🟠 **4** high findings
- 🟡 **4** medium findings
- 🟢 **2** low findings
- ✅ **29** checks passed clean

### Top 3 recommendations

1. **Treat the imported sales/car dataset as a known-incomplete legacy block and back-fill it.** The combination of findings #1, #2, #3, #4, #6, and #11 all point at the same root cause: a one-shot data import of 120 sales / 185 cars that arrived with no pricing, no creator attribution, no `sold_at`, no PDI completion. Coordinate with the business owner to either (a) pull the missing fields from the DMS export and run a one-time backfill migration, or (b) explicitly tag these rows as `legacy_import` so reports/commissions/warranty workflows skip them. Until then, every sales/finance report off this DB is structurally inaccurate.

2. **Reconcile the dual capability model on `profiles`.** Finding #10 — `capabilities` (text[]) and `capabilities_jsonb` (jsonb) are two different vocabularies and one owner has an empty jsonb. Pick one as authoritative, document the mapping, and remove or backfill the other. Risk: depending on which code path reads which column, the same user may pass an authorization check in one place and fail in another.

3. **Address Supabase RLS performance lints.** The 17 `multiple_permissive_policies` and 3 `auth_rls_initplan` warnings (finding #13) are easy wins that compound across every read on the affected tables. Combine overlapping permissive policies into one, and wrap `auth.uid()` in a `(SELECT auth.uid())` subquery so Postgres can initplan-cache it.

### Constraints honoured
- All queries were read-only (`execute_sql`). No `apply_migration` calls. No data modified.
