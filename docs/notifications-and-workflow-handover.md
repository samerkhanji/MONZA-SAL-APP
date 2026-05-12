# Notifications + workflow autopilot — handover

What was built this week (May 12), how it works in production, and what
remains open.

## At a glance

| Day | PR | What landed |
| --- | --- | --- |
| 1 | [#39](https://github.com/samerkhanji/MONZA-CRM/pull/39) | Notifications v2 schema, task taxonomy + routing rules, `emit_notification` dispatcher, Realtime publication |
| 1 | [#40](https://github.com/samerkhanji/MONZA-CRM/pull/40) | Hybrid users included in role pools by capability |
| 1 | [#41](https://github.com/samerkhanji/MONZA-CRM/pull/41) | Auto-create garage job card on car arrival + fix `garage_jobs.status` CHECK |
| 2 | [#42](https://github.com/samerkhanji/MONZA-CRM/pull/42) | Bell v2 + `/notifications` inbox + `/settings/notifications` |
| 3 | [#43](https://github.com/samerkhanji/MONZA-CRM/pull/43) | `set_garage_job_category` RPC + intake picker UI + stuck-job cron |
| 4 | [#44](https://github.com/samerkhanji/MONZA-CRM/pull/44) | Owner reports views + `/reports` page |
| 5 | [#45](https://github.com/samerkhanji/MONZA-CRM/pull/45) | Nav links: `/reports`, `/notifications`, `/settings/notifications` |
| 5 | [#46](https://github.com/samerkhanji/MONZA-CRM/pull/46) | Build hotfix: use `hasCapability()` helper |

Migrations applied to prod: **087a, 087b, 087c, 087d, 087e, 088, 089, 090, 091.**

## How it works end to end

### Car arrival → job card → tasks → notifications

1. Car flips to `location_type = 'garage'` (manually from Cars page or via any insert).
2. `cars_auto_create_garage_job` trigger inserts a stub `garage_jobs` row (status `pending`, no bay, `task_category_id = NULL`, title `Service intake — <brand> <model> · <last 8 of VIN>`).
3. Garage page shows the stub with an amber **Needs intake — pick a reason to fan out tasks** banner.
4. Garage manager / staff opens **Set category** dialog, picks one of 13 reasons, optionally enters km.
5. `set_garage_job_category(job, category, km)` RPC:
   - Sets category + km, flips status to `in_progress`, stamps `started_at` + `due_date` from category SLA.
   - Reads `task_routing_rules` for the category, resolves recipients (user / role / capability), with hybrid pool inclusion based on capability mapping.
   - Inserts one `tasks` row per (rule × recipient) with `due_at = SLA deadline`, `status = 'open'`, priority from category severity.
   - Calls `emit_notification('task.assigned' | '_urgent' | '_critical', …)` per task.
6. Each assignee's bell badge ticks up; while their browser tab is open they get a sonner toast (severity-colored).

### The 13 categories + their primary owners

Editable via `task_categories` + `task_routing_rules` tables. Settings UI for editing these is **not yet built**.

| Category | SLA (h) | Primary | Parallel |
| --- | --- | --- | --- |
| Software / OTA | 48 | Mark | — |
| Scheduled service | 8 | any garage_staff (+ Khalil via hybrid) | manager visibility |
| Customer complaint | 24 | Mark (triage) | — |
| Body / paint | 120 | garage_manager | Samaya (insurance flag) |
| Warranty claim | 72 | garage_staff | Lara (DMS prep) |
| Recall / safety | 72 | garage_staff | Lara (Dongfeng report) |
| Accessory install | 72 | Mark (stock) | garage_staff (install) |
| Parts request | 24 | Mark | — |
| PDI | 120 | garage_staff | Samaya (AIA/customs) |
| Delivery prep | 48 | garage_staff | Samaya (handover) |
| Service + finance combo | 48 | garage_staff | Samaya + Lara |
| Trade-in inspection | 24 | Mark | — |
| Internal / staff vehicle | 168 | garage_manager schedules | — |

### Notification matrix (events → recipients)

11 event rules pre-seeded into `notification_event_rules`. Editable in
the same way as routing rules.

| Event | Severity | Recipients (in-app) | Email | WhatsApp |
| --- | --- | --- | --- | --- |
| `repair_proposal.stale_7d` | warning | service advisor + garage manager | yes | no |
| `repair_proposal.stale_14d` | urgent | owner | yes | yes |
| `installment.underpayment` | urgent (critical for owner) | Lara, Samaya, owner | yes | owner only |
| `installment.overpayment` | warning | Lara, Samaya, owner | Lara/Samaya only | no |
| `installment.30d_late` | critical | Lara, Samaya, owner | yes | owner |
| `customer.created` | info | Lara, Samaya **only** (never owner) | no | no |
| `garage_job.stuck_7d` | warning | garage manager + service advisor | manager | no |
| `garage_job.stuck_14d` | urgent | owner | yes | yes |
| `parts.low_stock` | warning | Mark + garage manager | Mark | no |
| `parts.low_stock_critical` | urgent | owner | yes | yes |
| `test_drive.overdue_1h` | warning | sales advisor + sales manager | yes | no |
| `test_drive.overdue_3h` | critical | owner | yes | yes |
| `warranty.expires_30d/14d/7d` | info → urgent | service advisor (+ Lara from 14d) | from 14d | from 7d |
| `request.submitted` | info | manager via capability | no | no |
| `request.sla_breach` | warning | owner | yes | no |
| `sale.voided` | critical | owner + Lara + sales | yes | owner |

`task.assigned` / `_urgent` / `_critical` (added in PR #43) ping the
event subject (the assignee).

### How "hybrid" routing works

A profile with `user_role = 'hybrid'` is included in role pools when it
holds the matching capability:

```
garage_staff   ↔ requires `garage`
garage_manager ↔ requires `garage` + `manage_team`
assistant      ↔ requires `cashier` OR `data_health`
```

Khalil's capabilities are `{garage, vehicle_software, events_ops,
inventory, sales, data_health}`. He's automatically pulled into
`garage_staff` and `assistant` pools, plus any `capability=`
notifications targeted at his caps.

### What runs on a schedule

- `send-workflow-reminders` (06:30 UTC daily) — repair proposal stale + abandoned-request reminders. *(predates this week)*
- `detect-stuck-garage-jobs` (07:00 UTC daily) — fires `garage_job.stuck_7d` (warning) and `garage_job.stuck_14d` (critical). Debounced via `system_events` log so each job only fires once per stage. **NEW**

## Where each thing lives

### UI

- **Bell** in top nav — `web/src/components/NotificationBell.tsx`. Realtime subscription per user; toasts on new INSERTs.
- **Inbox** — `/notifications` (`web/src/app/(dashboard)/notifications/page.tsx`). Tabs: All · Unread · Critical · Approvals · Assignments · Alerts · Mentions · Replies · Status · Customer.
- **Preferences** — `/settings/notifications` (`web/src/app/(dashboard)/settings/notifications/page.tsx`). Channel toggles, quiet hours, digest categories, muted entities.
- **Set category dialog** — `web/src/components/garage/SetJobCategoryDialog.tsx`.
- **Reports** — `/reports` (`web/src/app/(dashboard)/reports/page.tsx`). Owner / `view_reports` / `manage_team` only.

### DB (key objects)

- `notifications` (extended in 087a) — main table, replicated to FE via Supabase Realtime.
- `notification_preferences` — per-user.
- `notification_event_rules` — `event_type → (category, severity, recipients, channels)`.
- `task_categories` — the 13 reasons.
- `task_routing_rules` — `category → (assignee_kind, value, primary/parallel)`.
- `tasks` — fan-out target. Unique on `(source_type, source_id, assigned_to_user_id)`.
- `customer_credits` — installment overpayment ledger (predates this week, from PR #35).
- Views: `report_sales_margin`, `report_sales_rep_performance`, `report_inventory_aging`, `report_aged_receivables`, `report_garage_time_in_state`.

### RPCs (callable from FE)

- `mark_notifications_read(uuid[])`
- `mark_all_notifications_read()`
- `snooze_notification(uuid, timestamptz)` — rejects critical
- `dismiss_notification(uuid)`
- `set_garage_job_category(uuid, text, integer)` — owner / `garage` / `manage_team`
- `apply_installment_payment(uuid, numeric, text, text, text)` — owner / `cashier`
- `recover_payment_plan_from_default(uuid, text)` — owner-only
- `gdpr_anonymize_customer(uuid, text)` — owner-only
- `void_sales_order(uuid, text)` — owner-only

### Internal (NOT FE-callable)

- `emit_notification(...)` — dispatcher, only callable from RPCs and trigger functions.
- `cars_auto_create_garage_job()` — trigger payload.
- `detect_stuck_garage_jobs()` — cron payload.

## Known gaps (what's still NOT built)

These are all real but were out of scope for this week:

1. **Email channel.** `notification_event_rules.channel_email` is set
   for the right rows; no worker reads them yet. When Resend (or
   similar) is wired up, a tiny Edge Function selecting rows where
   `delivered_email_at IS NULL AND <rule.channel_email>` and posting
   them, then stamping `delivered_email_at`, will turn this on.
2. **WhatsApp channel.** Same pattern as email but with WhatsApp
   Business API. The rule rows already say which events should send
   WhatsApp; just needs the worker.
3. **Settings UI for editing routing/notification rules.** Tables are
   `is_owner OR has_capability('manage_team')` writable, but there's
   no UI yet — you'd have to edit them in Supabase Studio. A simple
   admin page is a half-day.
4. **Test-drive overdue cron.** The notification rules exist
   (`test_drive.overdue_1h`, `test_drive.overdue_3h`) but nothing
   currently emits them. Needs a cron similar to `detect-stuck-garage-jobs`
   but every 15 min (since these are hours, not days).
5. **Warranty expiry cron.** Same — rules exist, no emitter yet.
6. **Auto-update car location on job state.** Right now you flip
   `cars.location_type = 'garage'` manually (or it gets set elsewhere).
   Auto-flipping when you Start a job + flipping back to `lot` /
   `delivered` when the job closes is a separate small piece.
7. **Mark-as-read on notification click → does not deep-link to record
   yet.** The Open → button in the inbox does, but clicking the body
   only marks read. Could route + mark in one click.
8. **Reports caching.** `/reports` does five parallel SELECTs on every
   load. Fine for now (small datasets); add `react-query` or a
   materialized view if it gets slow.
9. **Time-in-state more granular.** The view currently uses
   `created_at → started_at → completed_at → delivered_at`.
   `waiting_parts` and `paused` time-in-state would need a separate
   timeline table tracking each transition. Tabled until job state
   transitions are richer.
10. **Notification digest scheduling.** `digest_categories` is
    persisted per user but no daily 8am job aggregates them yet.

## How to test it (manual smoke checklist)

After everything deploys:

1. As owner, open `/`. Old "permission denied" errors should be gone.
2. Navigate to `/garage`. The MHero M HERO 2 stub should show the amber
   "Needs intake" banner.
3. Click **Set category** → pick `Scheduled service` → enter km → save.
   - Toast: "Category set · 3 tasks created."
   - Bell badges for Suhail, Khalil, and Mark should populate (they'll
     each see their own toast if logged in).
4. Open `/notifications`. The new task assignment should show in the
   Assignments tab.
5. Open `/settings/notifications`. Toggle email or set quiet hours; the
   change should save in place.
6. As owner, navigate to `/reports`. All five sections should render
   with live data; today: 1 sale margin, 7 reps, 65 cars in stock,
   0 receivables, 0 closed jobs.

## How to keep building from here

- **Add a new notification event:** insert into `notification_event_rules`
  + call `emit_notification('your.event', …)` from wherever it should
  fire. Bell + toast wire up automatically.
- **Add a new task category:** insert into `task_categories` (set
  `sla_hours` etc.) + add `task_routing_rules` rows.
- **Re-route a category:** update / delete / insert into
  `task_routing_rules`. No code change.
- **Add a report:** create a SECURITY-INVOKER view +
  `GRANT SELECT TO authenticated` + add a card to `/reports`.

---

Ship list this week: 9 PRs (#39 → #46), 9 migrations (087a-091),
4 new pages (`/notifications`, `/settings/notifications`, `/reports`,
plus the intake dialog), 1 new top-level nav entry, and the underlying
notification + task-fan-out infrastructure.
