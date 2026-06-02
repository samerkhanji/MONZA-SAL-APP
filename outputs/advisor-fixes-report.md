# Supabase Advisor Fixes — Report

**Run date:** 2026-06-02
**Project:** `okxpsvukzjjubinhamek` (Monza SAL APP)
**Branch:** `claude/advisor-fixes-and-pull-drift`
**Migration applied:** `apply_advisor_safe_perf_fixes` (live + repo file `164_apply_advisor_safe_perf_fixes.sql`)

---

## TL;DR

| Category | Severity | Before | After | Status |
|---|---|---:|---:|---|
| `auth_rls_initplan` | WARN | 3 | 0 | ✅ FIXED |
| `multiple_permissive_policies` | WARN | 17 | 0 | ✅ FIXED |
| `unindexed_foreign_keys` | INFO | 54 | 0 | ✅ FIXED |
| `unused_index` | INFO | 62 | 116 | 🔵 DEFERRED (54 net-new from this migration, expected) |
| `authenticated_security_definer_function_executable` | WARN | 58 | 58 | 🟡 USER DECISION |

- Performance advisor: **20 WARN → 0 WARN** (74 actionable findings resolved).
- Total perf lints: **136 → 116** (the 20 net-decrease are the WARNs we fixed; INFO `unused_index` count went up by 54 because new indexes haven't been used yet — they will be once tables grow, this is normal).
- Security advisor: 58 WARNs untouched per task instructions (require user decisions on RPC grants).

---

## Performance findings

### ✅ `auth_rls_initplan` — APPLIED

3 policies on `public.notification_preferences` called `auth.uid()` per-row. Rewrote to use `(SELECT auth.uid())`:

- `notif_prefs_ins` (INSERT) — `with_check: user_id = (SELECT auth.uid())`
- `notif_prefs_sel` (SELECT) — `using: (user_id = (SELECT auth.uid())) OR is_owner()`
- `notif_prefs_upd` (UPDATE) — both clauses

### ✅ `multiple_permissive_policies` — APPLIED

17 tables had a permissive `_sel` (SELECT) policy AND a `_write` policy declared `FOR ALL` (which also matches SELECT). Strategy: drop the `_write` `FOR ALL` and create 3 explicit replacements (`_ins`, `_upd`, `_del`). This preserves write semantics exactly while leaving `SELECT` with a single permissive policy (the original `_sel`).

Tables consolidated:
`approval_thresholds`, `cash_drawers`, `cash_movements`, `cash_sessions`, `cash_settings`,
`notification_event_rules`, `purchase_orders` (drops `po_write`), `recall_vehicles`, `recalls`,
`service_intervals`, `task_categories`, `task_routing_rules`, `trade_in_documents`,
`trade_in_issues`, `warranty_case_documents`, `warranty_case_parts`, `warranty_cases`.

Every `qual`/`with_check` was read first from `pg_policies` and reproduced byte-for-byte; the only change is the `cmd` (ALL → INSERT/UPDATE/DELETE).

### ✅ `unindexed_foreign_keys` — APPLIED

All 54 flagged FK columns now have a `CREATE INDEX IF NOT EXISTS idx_<tbl>_<col>` covering index. See `164_apply_advisor_safe_perf_fixes.sql` for the exact list.

### 🔵 `unused_index` — DEFERRED (expected)

62 indexes (pre-migration) had never been hit. After the migration the count is 116 — because the 54 new FK indexes start unused. They'll see traffic as soon as users delete/update rows in the parent tables (Postgres uses these to validate FK targets). Re-evaluate in 2-4 weeks.

Suggested followup: keep deferred. Drop only after sustained traffic shows persistent unused indexes that are NOT FK-covering.

---

## Security findings — 🟡 USER DECISION

The security advisor flagged **58** `authenticated_security_definer_function_executable` WARNs — every `SECURITY DEFINER` function in `public` is callable by the `authenticated` role.

Per task instructions, these were NOT touched. They require human review on a per-function basis.

### Internal helpers (10) — likely safe to lock down

These are RBAC helpers used inside RLS policies. They should be revoked from `authenticated` (if not already, double-check via `\df+`) and called only from within other `SECURITY DEFINER` code:

- `public._require_any_capability(p_caps public.user_capability[])`
- `public.can_view_owner_requests()`
- `public.get_my_user_role()`, `public.get_my_user_role_resolved()`
- `public.has_role(r public.user_role)`, `public.is_role(p_role public.user_role)`
- `public.is_any_role(...)`, `public.is_any_role_resolved(...)`
- `public.is_owner()`, `public.is_pipeline_user()`

Proposed fix:
```sql
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM authenticated, anon, public;
-- repeat for each helper
```
Migration `068_lockdown_internal_definer_fns.sql` and `069_revoke_helper_fn_api_access.sql` ostensibly already do this for some — confirm coverage before applying anything new. The advisor flag may simply be reading from an out-of-date cache; run `get_advisors` again to confirm.

### User-facing RPCs (48) — keep but audit each body

These are RPCs the UI legitimately calls (e.g. `approve_purchase_order`, `close_cash_session`, `open_cash_session`). For each:
1. Confirm the body checks the caller's capability (most do via `is_owner()` / `has_capability(...)`).
2. Confirm `search_path` is set (`SET search_path TO 'public', 'pg_temp'`).
3. Decide whether to keep `SECURITY DEFINER` (needed if the function writes to tables the caller has no direct RLS access for) or switch to `SECURITY INVOKER`.

No code change without explicit user sign-off — these are load-bearing and a wrong revoke breaks the app.

---

## Drifted migrations pulled into repo

Live had 4 migrations not in `supabase/migrations/`. I added 3 files (deciding to skip the superseded one as documented in-line):

| Live version | Live name | Repo file | Notes |
|---|---|---|---|
| `20260526101310` | `enable_pipeline_user_for_remaining_employees` | `161_enable_pipeline_user_for_remaining_employees.sql` | `UPDATE profiles SET is_pipeline_user = true` for lara, samaya, suhail. |
| `20260526121200` | `detect_warranty_expiry_add_dms` | — | **SKIPPED.** Superseded by 163 (mentioned in 162's header for traceability). |
| `20260526125700` | `migrate_legacy_car_statuses_to_in_stock` | `162_migrate_legacy_car_statuses_to_in_stock.sql` | `UPDATE cars SET status = 'in_stock' WHERE status IN ('inventory','available')`. |
| `20260526125825` | `detect_warranty_expiry_helper_and_all_columns` | `163_detect_warranty_expiry_helper_and_all_columns.sql` | Adds `_emit_warranty_bucket` helper + rewrites `detect_warranty_expiry()` to monitor 5 warranty columns. Function bodies pulled verbatim from `pg_proc`. |

(There is also a 5th newer live-only migration `20260602090124` `enable_pg_trgm_for_fuzzy_search` — outside this PR's scope per the task brief.)

---

## Files added in this PR

- `supabase/migrations/161_enable_pipeline_user_for_remaining_employees.sql`
- `supabase/migrations/162_migrate_legacy_car_statuses_to_in_stock.sql`
- `supabase/migrations/163_detect_warranty_expiry_helper_and_all_columns.sql`
- `supabase/migrations/164_apply_advisor_safe_perf_fixes.sql`
- `outputs/advisor-fixes-report.md` (this file)

The migration `164_apply_advisor_safe_perf_fixes.sql` was applied live as Supabase migration `apply_advisor_safe_perf_fixes` immediately after the WARN-level perf fixes were authored. Files 161–163 reflect already-applied live state.
