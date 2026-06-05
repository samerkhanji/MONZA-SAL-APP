# Data Reset — Working Note (resume here)

> **Status: PLANNING ONLY. Nothing has been deleted.** Do not run any deletes until
> (a) a backup/PITR restore point is confirmed and (b) the open decisions below are answered.

## Goal (from owner)
Reset **test/operational** data on the **Monza SAL APP** Supabase project
(`okxpsvukzjjubinhamek`) to a clean state for a **private internal launch**, while
**keeping real/master data**: cars, customers (incl. names & numbers), employees/profiles.

## Inventory snapshot (read-only, captured 2026-06-05)
`select c.relname, c.reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.reltuples>0 order by 1;`

| table_name | approx_rows |
| --- | --- |
| accessory_inventory | 36 |
| car_events | 217 |
| car_warranties | 185 |
| cars | 185 |
| customers | 185 |
| garage_bays | 16 |
| garage_capacities | 9 |
| garage_jobs | 1 |
| garage_task_template_items | 3 |
| garage_task_templates | 1 |
| garage_tasks | 3 |
| infrastructure_compute_target | 1 |
| notification_event_rules | 51 |
| notification_preferences | 7 |
| notifications | 77 |
| parts | 2 |
| profiles | 8 |
| push_subscriptions | 1 |
| sales_orders | 120 |
| system_events | 74 |
| system_preferences | 7 |

> NOTE: this list only shows tables with a non-zero **estimated** row count (`reltuples`),
> which can be stale/zero right after creation. Several expected tables did **not** appear
> (cash_sessions, cash_movements, refunds, payment_plans, installment_payments,
> purchase_orders + children, trade_ins, warranty_cases, recalls, invoices, commissions,
> test_drives, requests, tasks). Re-run with exact `count(*)` per table tomorrow before
> finalizing the script (estimates ≠ truth).

## Keep vs Reset (proposed — needs confirmation)
- **KEEP (real/master + config):** `cars`, `customers`, `profiles`, `car_warranties`,
  `car_events`(?), garage config (`garage_bays`, `garage_capacities`,
  `garage_task_templates`, `garage_task_template_items`), `notification_event_rules`,
  `system_preferences`, `notification_preferences`, `push_subscriptions`,
  `infrastructure_compute_target`, `system_events`(?).
- **RESET (operational/test transactions):** `sales_orders`, `garage_jobs`, `garage_tasks`,
  `notifications`, plus (once confirmed present) `cash_sessions`, `cash_movements`,
  `refunds`, `payment_plans`, `installment_payments`, `purchase_orders` (+lines/invoices/
  payments), `trade_ins`, `warranty_cases`, `recalls`, `invoices`, `commissions`,
  `test_drives`, `requests`, `tasks`, `part_movements`.
- **AMBIGUOUS — owner to decide:** `parts` (2), `suppliers`, `accessory_inventory` (36),
  `car_documents` / `customer_documents`. Keep (reference) or wipe (test)?

## OPEN DECISIONS (blockers before writing the script)
1. **Backup/PITR confirmed?** (manual snapshot or Point-in-Time Recovery on) — required.
2. **parts / suppliers / accessory_inventory → keep or wipe?**
3. Confirm the KEEP/RESET split above.

## Technical constraints for the reset script
- `block_hard_delete_financial_tables` trigger **blocks raw DELETE** on:
  `sales_orders, invoices, refunds, installment_payments, cash_movements, purchase_orders,
  purchase_order_payments, purchase_order_invoices`. → must use the **`soft_delete_*` RPCs**
  for those, not `DELETE`/`TRUNCATE`.
- Respect **FK order** (children before parents): e.g. installment_payments → payment_plans;
  PO lines/receipts/payments/invoices → purchase_orders; cash_movements → cash_sessions;
  garage_tasks → garage_jobs.
- Closed cash sessions are locked (mig 107) — closing/deleting may need owner RPC path.
- The `cars`/`customers`/`profiles` KEEP set must not be touched; FKs from reset tables point
  *to* them (so deleting children is fine, parents stay).

## Where the rest of the project stands (2026-06-05)
- Merged to `main`: #173–#178.
- Open branches: `claude/price-removal-plan`, `claude/launch-readiness-0605`,
  `claude/data-reset-plan` (this note).
- Launch checklist (`docs/launch-readiness-2026-06-05.md`): apply migrations **169–171** to
  prod; clean test data (this reset); confirm Vercel secrets; price-removal **Phase A**
  decision; verify the "freeze".
- Security advisors: all WARN, 0 errors (not a blocker).

## Next step tomorrow
1. Owner confirms backup + the 3 open decisions.
2. Re-run exact `count(*)` per RESET table.
3. I generate the FK-safe, soft-delete-aware reset script for final approval.
