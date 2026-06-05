# Price Removal Plan (car sale / repair-fix / customer-pay prices)

> Status: **PLAN ONLY — no code changed.** Awaiting decisions on the ambiguous items in §2.

## 1. Scope & boundary

**Remove from this app** (a separate system will own them):
- **Car sale prices** — `cars.price` / `price_currency`, `sales_orders.selling_price` / `currency` / `quote_amount` / `quote_currency`.
- **Repair / fix prices** charged to customers — `repair_proposal_items.unit_price` / `total_price` (part/labor/service lines).
- **Customer-pay prices** — customer `invoices.total_amount` / `paid_amount`.
- Everything **derived** from the above: revenue / margin / sales-rep performance reports, owner-overview revenue KPIs, "missing selling price" Data Health flags, price columns in exports, and stale price copy in the AI prompt / tours.

**Keep, do NOT touch (confirmed):**
- **Installments** — `payment_plans` (`total_amount`, `down_payment`, `monthly_amount`), `installment_payments` (`amount_due`, `paid_amount`).
- **Cash Register** — `cash_sessions` balances, `cash_movements` amounts, `cash_settings`.

---

## 2. Decisions — LOCKED (2026-06-05)

| # | Item | Decision |
|---|------|----------|
| D1 | `sales_orders.deposit_amount` / `_currency` / method | **KEEP** (treated as a money intake, like cash/installments) |
| D2 | `refunds.amount` / `currency` (garage refunds) | **REMOVE** (customer-pay) — keep refund record/status, drop amount; affects cash refund bridge + refund-sourced customer credits |
| D3 | `trade_ins.accepted_value` (+ provisional/recommended/estimated_repair_cost) | **KEEP** |
| D4 | `cars.customs_amount_paid` / `_currency` | **KEEP** (internal cost) |
| D5 | `parts.unit_cost` / `currency` | **KEEP** (supplier-facing) |
| D6 | Purchase Orders money | **KEEP** (supplier-facing) |
| D7 | `company_costs.amount` | **KEEP** (internal) |
| D8 | `marketing_campaigns.budget_amount` | **KEEP** (internal) |
| D10 | `warranty_case_parts.unit_cost` / recall repair cost | **KEEP** (internal) |

### Still open (lower-priority sub-decisions; proposed defaults)
| # | Item | Proposed default |
|---|------|------------------|
| D9 | `commissions.amount` (derived from sale revenue, which is leaving) | Keep the commissions table; commission amount becomes **decoupled from revenue** (manual / its own input) — confirm, or move commissions to the separate system too. **Not blocking** the sale/fix/refund removal. |
| D11 | `customer_credits.amount` | **Keep table.** Installment-overpayment credits stay; the **refund→credit** path is retired with D2. |
| D12 | `approval_thresholds` | **Keep config.** Revisit refund approval gating when refunds are removed (D2). |
| D13 | Aged-receivables KPI | **Keep** (installments-backed). |

**Net effect of locked decisions:** the removal targets **car sale prices**, **repair/fix prices**, and **customer refunds** + everything derived (revenue/margin/sales-rep reports, revenue KPIs, "missing price" Data Health flags, price exports, stale AI/tour copy). **Deposits and trade-in values stay.**

---

## 3. Phased execution (after decisions)

Designed so nothing destructive happens early. **Columns are dropped LAST**, only once the separate pricing system is live and any history is exported — column drops are irreversible.

### Phase A — Remove price **UI + displays** (reversible, immediate, low risk)
Stop showing and collecting prices. DB columns stay (dormant). User-visible effect is immediate; easy to revert.
- **Cars:** remove Price/Currency inputs from `edit-car-dialog.tsx`, `cars/add/page.tsx`; remove price prefill→sales_order in `cars/[id]/page.tsx`.
- **Sales Orders:** remove selling_price/currency/quote columns, revenue totals, and export columns in `sales-orders/page.tsx` + `[id]/page.tsx`.
- **Sell-car flow:** surgically remove selling_price/currency from `status-customer-dialog.tsx` **(keep the installments block in the same file)**.
- **Customers:** drop order price columns in `customers/page.tsx` + `[id]/page.tsx`.
- **Repair/fix:** remove unit_price/total_price from `garage/RepairProposalPanel.tsx` (the customer quote).
- **Reports:** remove the margin/revenue/sales-rep panels in `reports/page.tsx`; keep aged-receivables per D13.
- **Dashboard/Overview:** remove revenue/margin KPIs in `overview/page.tsx` + `overview-dashboard.tsx`; keep cash + (per D13) receivables.
- **Data Health:** drop the "missing selling_price/currency" check from `data-health/page.tsx` **and** `api/data-health/count/route.ts` (this also resolves DATA-01 — the badge/page reconcile cleanly with that false-positive gone; the shared-count refactor can ride along here).
- **AI prompt + Tours:** remove stale price copy/selectors (`lib/ai/system-prompt.ts`, `lib/tours/*`, update `tour-sensitive.test.ts`).
- **Excel import:** stop back-filling `selling_price` from car price in `ImportExcelDialog.tsx`.

### Phase B — Stop **writes** & retire price-derived data
- Forms no longer set `price` / `selling_price` / `currency` / repair line prices.
- Retire/repoint DB **views**: `report_sales_margin`, `report_sales_rep_performance`, and the price column on `report_inventory_aging`. (`report_aged_receivables` stays — installments.)
- Regenerate `lib/supabase/database.types.ts` after any view change.

### Phase C — Schema deprecation (DEFERRED, destructive — separate effort)
Only after the new pricing system is live and history migrated/exported:
- Drop columns: `cars.price`/`price_currency`, `sales_orders.selling_price`/`currency`/`quote_*` (**keep `deposit_*`** per D1), `repair_proposal_items.unit_price`/`total_price`, customer `invoices` money, `refunds.amount`/`currency` (D2), and recut `cars_display` / `cars_with_sales`.
- Update the `block_hard_delete_financial_tables` trigger and any RPCs (`complete_delivery`, `void_sales_order`, refund/deposit cash bridges) accordingly.
- Take backups first; do as its own reviewed migration.

---

## 4. Cross-cutting cautions
- **Surgical files** (contain BOTH keep & remove): `status-customer-dialog.tsx`, `reports/page.tsx`, `overview/page.tsx` + `overview-dashboard.tsx`. Edit carefully to preserve installments/cash.
- **Cash bridges:** `cash_movements.kind` includes `sale_deposit`, `refund`, `service_payment`, `parts_payment`. Deposits stay (D1) so `sale_deposit` is unaffected; **refunds are removed (D2)** so the refund→cash bridge (`refund_payment_to_cash_movement`) loses its source — make `refund` a manual-entry kind or drop the bridge in Phase C.
- **`block_hard_delete_financial_tables`** guards `sales_orders, invoices, refunds, …` — must be updated before any table/column drop.
- **Generated types** (`database.types.ts`) must be regenerated whenever a column/view changes.
- **Tests/tours** referencing price UI will need updating in the same PR that removes the UI.

---

## 5. Suggested PR breakdown (small, reviewable)
1. Data Health: drop price flag + reconcile badge/page (DATA-01) — smallest, self-contained.
2. Reports + Overview: remove revenue/margin panels & KPIs.
3. Cars: remove price inputs/displays.
4. Sales Orders + Customers: remove price columns/displays.
5. Sell-car dialog: surgical selling_price removal (keep installments).
6. Repair proposal: remove fix-price line items.
7. AI prompt + tours + import cleanup.
8. (Deferred) Phase B views + Phase C schema migration.

Each is independently revertable; none drops a DB column until Phase C.
