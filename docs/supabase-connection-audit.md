# Supabase Connection Audit — Monza App

> Refresh of the Feb 2025 audit, current as of migration `132` and launch sprint PRs #67–#74. Project: `okxpsvukzjjubinhamek`, region `eu-central-1`.

---

## 1. Environment variables

The web app (Next.js, deployed on Vercel) consumes:

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | client.ts, server.ts, middleware.ts, admin.ts | Project URL `https://okxpsvukzjjubinhamek.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (or publishable) | client.ts, server.ts, middleware.ts | Preferred legacy JWT |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | fallback | resolved by `getSupabasePublicKey()` | Vercel sometimes ships the new `sb_publishable_*` token; the helper picks anon first, publishable second |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (server-only) | admin.ts | Used by `/api/admin/*`, `/api/send-push`, auth admin ops (createUser, deleteUser, generateLink). **NEVER** import from a `"use client"` module |

Service-role usage notes:

- `notify_expiring_warranties` runs in-database via `pg_cron` (`detect_warranty_expiry` schedule, mig 092). It does NOT require `SUPABASE_SERVICE_ROLE_KEY` because pg_cron executes as a superuser inside the DB.
- The Edge Function path was deprecated in favor of `pg_cron`; if a future cron is moved to Edge Functions, that function would need the service-role key in its secrets.
- Admin-only API routes (`/api/admin/force-reset`, team management) gate behind the `ADMIN_API_SECRET` bearer in addition to the service role.

Resolver code: `web/src/lib/supabase/public-env.ts`.

---

## 2. Tables and views (live snapshot)

71 base tables + 13 views grouped by domain:

**Inventory**: `cars`, `car_documents`, `car_events`, `car_warranties`, `cars_display` (view), `cars_missing_data` (view), `car_service_status` (view), `service_intervals`

**CRM**: `customers`, `customer_notes`, `customer_documents`, `customer_interactions`, `customer_credits`, `customer_credit_balance` (view), `customers_display` (view), `requests`, `delete_requests`, `document_access_requests`, `page_access_requests`

**Sales**: `sales_orders`, `payment_plans`, `installment_payments`, `test_drives`, `invoices`, `commissions`, `repair_proposals`, `repair_proposal_items`

**Garage**: `garage_jobs`, `garage_bays`, `garage_capacities`, `garage_tasks`, `garage_task_templates`, `garage_task_template_items`, `parts`, `part_movements`, `job_parts`, `job_documents`, `job_time_entries`, `bay_assignment_history`, `garage_job_bay_context`, `task_timers`, `accessory_inventory`, `accessory_custom_tables`, `accessory_custom_items`

**Warranty / Recalls / Refunds**: `warranty_cases`, `warranty_case_parts`, `warranty_case_documents`, `warranty_notifications_sent`, `recalls`, `recall_vehicles`, `refunds`

**Trade-ins**: `trade_ins`, `trade_in_issues`, `trade_in_documents`

**Cash**: `cash_drawers`, `cash_sessions`, `cash_movements`, `cash_settings`

**PO lifecycle**: `purchase_orders`, `purchase_order_lines`, `purchase_order_receipts`, `purchase_order_receipt_lines`, `purchase_order_invoices`, `purchase_order_payments`

**Suppliers / Tasks**: `suppliers`, `appointments`, `tasks`, `task_categories`, `task_routing_rules`

**Profiles / Auth**: `profiles`

**Notifications**: `notifications`, `notification_event_rules`, `notification_preferences`, `push_subscriptions`, `service_day_notifications_sent`, `system_events`

**Approvals**: `approval_thresholds`

**Reports (views)**: `report_aged_receivables`, `report_garage_time_in_state`, `report_inventory_aging`, `report_sales_margin`, `report_sales_rep_performance`, `garage_bay_utilization`, `garage_employee_efficiency`, `garage_job_efficiency`

**System**: `system_preferences`, `infrastructure_compute_target`

(For full column lists by table, see `docs/schema.md`.)

---

## 3. RPC functions (most-used by the UI)

| RPC | Primary callers (UI) | Capability gate |
|---|---|---|
| `move_car` | `components/move-car-dialog.tsx` | inventory \| garage \| sales |
| `create_car` | `app/(dashboard)/cars/new/page.tsx` | inventory |
| `complete_delivery` | `app/(dashboard)/sales-orders/[id]/page.tsx` | sales |
| `void_sales_order` | `app/(dashboard)/sales-orders/[id]/page.tsx` | owner \| sales_ops |
| `apply_part_to_job` / `use_part_on_job` | `components/garage/StockMovementDialog.tsx`, `garage/jobs/[id]/page.tsx` | garage |
| `return_part_from_job` | `garage/jobs/[id]/page.tsx` | garage |
| `move_part_stock` | `components/garage/StockMovementDialog.tsx` | garage \| inventory |
| `attach_job_to_bay`, `release_bay`, `scan_vin_to_bay` | `components/garage/AssignJobToBayDialog.tsx`, `ReleaseBayMenu.tsx`, `GarageBaySection.tsx` | garage |
| `set_garage_job_category` | `components/garage/SetJobCategoryDialog.tsx` | garage |
| `create_payment_plan` | `app/(dashboard)/installments/page.tsx` | sales \| cashier |
| `apply_installment_payment` | `app/(dashboard)/installments/page.tsx` | cashier |
| `recover_payment_plan_from_default` | `app/(dashboard)/installments/page.tsx` | owner \| cashier |
| `open_cash_session` / `close_cash_session` / `record_manual_cash_movement` | `app/(dashboard)/cash/page.tsx` | cashier |
| `request_refund` / `approve_refund` / `reject_refund` / `mark_refund_paid` / `cancel_refund` | `garage/refunds/page.tsx`, `garage/refunds/[id]/page.tsx` | sales \| cashier \| owner |
| `submit_purchase_order` / `approve_purchase_order` / `reject_purchase_order` / `send_purchase_order` / `cancel_purchase_order` | `garage/purchase-orders/page.tsx`, `garage/purchase-orders/[id]/page.tsx` | garage_manager \| owner \| inventory |
| `record_purchase_order_receipt` / `attach_purchase_order_invoice` / `record_purchase_order_payment` | `garage/purchase-orders/[id]/page.tsx` | garage \| inventory \| cashier |
| `request_trade_in` / `start_trade_in_inspection` / `complete_trade_in_inspection` / `approve_trade_in` / `reject_trade_in` / `cancel_trade_in` / `commit_trade_in_to_sale` | trade-in pages | sales \| owner \| garage |
| `set_warranty_case_status`, `set_recall_status`, `assign_recall_vehicles`, `mark_recall_vehicle` | `garage/recalls/page.tsx`, `garage/recalls/[id]/page.tsx` | garage \| owner \| garage_manager |
| `gdpr_anonymize_customer` | `app/(dashboard)/customers/[id]/page.tsx` | owner |
| `mark_notifications_read`, `mark_all_notifications_read`, `dismiss_notification`, `snooze_notification` | `components/NotificationBell.tsx` | self |
| `generate_po_number`, `generate_recall_number`, `generate_warranty_case_number` | dialog-open helpers | any authenticated |
| `delete_job_time_entry` | `components/garage/JobTimeEntryControls.tsx` | garage |

The UI calls ~45 distinct RPCs total (full grep: `web/src/` → `\.rpc\("…"\)`). All write-side RPCs are SECURITY DEFINER with `_require_any_capability(...)` at entry.

---

## 4. Storage buckets

| Bucket | Public | Used by |
|---|---|---|
| `car-documents` | private | PDI photos, job cards under `app/(dashboard)/cars/[id]/` |
| `customer-documents` | private | KYC / contracts under `app/(dashboard)/customers/[id]/` |
| `job-documents` | private | Repair photos / invoices under `app/(dashboard)/garage/jobs/[id]/` |
| `request-attachments` | private | Owner-request attachments |

Access via signed URLs only. RLS on `storage.objects`:

- Migration `127_storage_doc_policies_scoped.sql` tightens `customer-documents` and `job-documents` to first-folder-segment + role/capability match.
- **127 must be applied manually via Dashboard → SQL Editor.** The MCP migration runner authenticates as `postgres`, which is not a member of `supabase_storage_admin` (the owner of `storage.objects`). Running this via `apply_migration` fails with `must be owner of relation objects (42501)`. The migration file carries a header explaining this.
- `car-documents` and `request-attachments` retain the previous bucket-level policy (unscoped per-folder); folder-scoping is on the post-launch roadmap.

---

## 5. `cars` table extra columns

Beyond the audit's original three (`vin`, `brand`, `model`), the live `cars` table now has 55 columns:

- `plate_number`, `model_year`, `exterior_color`, `interior_color`, `trim`, `suffix`, `specs`, `engine_number`
- `status`, `location_type`, `location_slot`, `location_floor`, `location_changed_at`, `status_changed_at`
- `pdi_status`, `customs_status`, `customs_amount_paid`, `customs_amount_currency`, `customs_notes`
- `battery_percent`, `km_range`, `current_km`, `software_version`, `software_update`, `dongle`, `is_erev`, `ev_km`, `motor_km`
- `price`, `price_currency`, `supplier_id`
- `warranty_per_dms`, `warranty_expiry`, `warranty_monza_start_date`, `warranty_vehicle_expiry`, `warranty_battery_expiry`
- `customer_id`, `reservation_date`, `sold_marker`, `sold_at`, `delivery_date`, `registration_date`, `bl_issue_date`, `date_bought`, `date_arrived`
- `sub_dealer_name`, `issue`, `notes`
- Audit: `created_at`, `created_by`, `updated_at`, `deleted_at`

All numeric money columns carry `>= 0` CHECK constraints (mig 062). Status/location have triggers and enum CHECKs.

---

## 6. `system_preferences`

Unchanged in shape since the Feb 2025 audit:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | text NOT NULL | logical key |
| `value` | text NOT NULL | serialized (often JSON) |
| `updated_by` | uuid | profiles.id |
| `updated_at` | timestamptz | |

---

## 7. `customer_documents`

Unchanged in shape:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid → customers | NOT NULL |
| `document_type` | text | e.g. id_card, contract |
| `file_name`, `file_path`, `file_size`, `mime_type` | text/int | path is `${customer_id}/${doc_type}/${ts}_${name}` |
| `notes` | text | |
| `uploaded_by` | uuid | |
| `created_at` | timestamptz | |

Reads now via signed URL with folder-scoped storage RLS (mig 127, manual). Row-level RLS on the table itself was widened to sales_ops in mig 126.

---

## 8. Issues found

### §8.1 `move_car(p_user_id := null)` — RESOLVED

Migration 062 added `resolve_actor_id(p_user_id) → COALESCE(p_user_id, auth.uid())` and the RPCs now reject null actors when no JWT is present. Verified by grep of `web/src/components/move-car-dialog.tsx` — the call site always passes the current user's id.

### §8.2 Unused `web/src/lib/supabase/server.ts` — SUPERSEDED

The file is now actively used by every server-side data fetch in the `app/` directory. The previously-noted ambiguity (server vs middleware vs admin) is resolved by three distinct files:

- `client.ts` — `"use client"` browser client
- `server.ts` — RSC/route handler client (cookie-bound)
- `middleware.ts` — `proxy.ts` entry, cookie refresh + auth gate
- `admin.ts` — service-role factory (server-only)

### §8.3 `updateSession()` silent-fail on missing env — RESOLVED IN BRANCH

The original audit flagged that `lib/supabase/middleware.ts` returned `NextResponse.next()` when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` were missing, letting unauthenticated traffic reach protected routes.

**Current state (verified in this audit):** `web/src/lib/supabase/middleware.ts` lines 45–71 now:

- In `NODE_ENV === 'development'`: `console.warn` and pass through (preserves DX).
- Otherwise: log a fatal error and return a `500` HTML response refusing to serve.

The hardfail was shipped on `hotfix/middleware-env-hardfail` and is on `main`. **No longer a launch blocker.** The parent process owns any follow-up tightening (e.g. exposing a health endpoint that bypasses the 500).

### §8.4 NEW — `notification_event_rules` not enforced for in-app delivery

`notification_event_rules.channel_inapp/email/whatsapp` flags exist (mig 087c), but the `emit_notification()` dispatcher (mig 087d) currently writes to the `notifications` table unconditionally for matched recipients. Email/whatsapp delivery is wired through `delivered_email_at`/`delivered_whatsapp_at` columns but no scheduled job consumes them yet. The UI bell still works (in-app channel); the gap is silent for external channels.

Mitigation: tracked in the launch-readiness doc (`docs/launch-readiness-2026-05-19.md`) under Notifications V2.

### §8.5 NEW — 8 advisor lints for `Security Definer View`

Several `report_*` views are `SECURITY DEFINER`, which the linter flags because they enforce the *creator's* permissions, not the caller's. Migration 101 revoked `anon` SELECT, but `authenticated` can still read them. Acceptable for now (the reports filter on RLS-eligible data); rewrite as `SECURITY INVOKER` views is on the post-launch roadmap.

### §8.6 NEW — `cash_settings` is a singleton

`cash_settings` has a `cash_settings_singleton` CHECK forcing `id = 'global'`. There is no UI to edit it; if `variance_threshold` needs adjustment, it must be done via the Dashboard or a one-off migration. Document for owner/operations.

### §8.7 NEW — `customer_credits` writes are RPC-less

`customer_credits` rows are inserted only by `request_refund` when `kind='goodwill'` and by manual SQL. There is no `apply_customer_credit` RPC to consume a balance on a sale; the `customer_credit_balance` view is read-only and the UI shows the balance but cannot redeem. **Out-of-scope for launch**, but flag for post-launch.

---

## 9. Connection flow summary

### Auth flow

1. User visits any page → `proxy.ts` → `updateSession()` in `middleware.ts`.
2. `updateSession()` calls `supabase.auth.getUser()` against `auth.users` via the cookie session.
3. If no user and route is non-public, redirect to `/` with `?redirectTo=<orig>`.
4. PKCE callback (`?code=...`) lands on `/` or `/login` and is forwarded to `/auth/callback`.
5. After login, the client client/server clients hydrate from the cookie set by `setAll`.
6. MFA: AAL2 enforcement is **deferred** post-launch — earlier RESTRICTIVE MFA policies were dropped (mig `drop_premature_mfa_restrictive_policies` 20260424). Owner MFA is encouraged but not enforced at the row level.

### Data flow

1. RSC fetches via `createClient()` (server.ts) with the user's JWT in cookies → RLS scopes reads.
2. Mutations go through SECURITY DEFINER RPCs gated by `_require_any_capability()`; the RPC reads `auth.uid()` for actor tracking via `resolve_actor_id()`.
3. Realtime: enabled for `notifications` (mig 087e). Bell subscribes per `user_id`.
4. Server-side privileged ops (`/api/admin/*`, `/api/send-push`) use `createAdminClient()` (service role).
5. Storage: signed URLs from `customer-documents` / `job-documents` after RLS check (mig 127, folder-scoped).
6. Cron: `pg_cron` schedules in-DB (`detect_*`, `purge_*`, `wake_*`, `send_workflow_reminders`, `advance_installment_statuses`, `notify_expiring_warranties`).

---

## 10. Checklist for Supabase Dashboard

- [ ] **Project**: `okxpsvukzjjubinhamek`, region eu-central-1, paused-on-idle OFF
- [ ] **Auth → URL configuration**: Site URL `https://crm.monza.com`; redirect allowlist includes Vercel preview wildcard and `https://crm.monza.com/auth/callback`
- [ ] **Auth → Providers**: Email magic link enabled; password reset enabled; phone OTP disabled
- [ ] **Auth → Email templates**: Custom templates for invite / reset use `{{ .RedirectTo }}/auth/confirm?token_hash=...&type=...` (PKCE) — not the legacy `/#access_token=` fragment
- [ ] **Auth → MFA**: TOTP enabled (enforcement deferred; rely on owner discretion)
- [ ] **Database → Webhooks**: none required (cron is in-DB)
- [ ] **Database → Functions**: 90 advisor lints exist (68 + 10 SECURITY DEFINER exec grants, 8 SECURITY DEFINER view, 4 mutable search_path). Accept for launch; rewrite plan post-launch.
- [ ] **Storage → Buckets**: all 4 buckets PRIVATE; **migration 127 applied via SQL editor**
- [ ] **Edge Functions**: none currently deployed; `/api/send-push` lives in Vercel
- [ ] **API → Settings**: anon key (or publishable) matches Vercel env; service-role key set as Vercel server-side secret only
- [ ] **Cron (pg_cron)**: verify all scheduled jobs exist via `SELECT jobname FROM cron.job` — expect `detect-overdue-test-drives`, `detect-warranty-expiry`, `advance-installment-statuses`, `purge-old-system-events`, `wake-snoozed-notifications`, `send-workflow-reminders`, `detect-service-due`, `detect-stuck-garage-jobs`
- [ ] **Realtime**: enabled for `notifications` table

---

*Audit refreshed 2026-05-19 by `docs/refresh-2026-05-19` branch. Original audit: Feb 2025.*
