# Monza App — Launch Readiness Addendum (2026-06-05)

> Builds on `docs/launch-readiness-2026-05-19.md`.
> **Deployment model: PRIVATE / INTERNAL via Vercel** — login-gated, no public website or app store.

## Verdict
**Functionally launch-ready.** The 2026-05-19 audit certified all RBAC, RLS, the 17 core workflows, and every route against the live DB. Since then the database has only been **hardened** (prod is now at migration `168`, up from `132`). What remains is **operational steps + a few decisions**, not new build work.

---

## Verified this session (read-only checks)

- **Security advisors:** 61 advisories, **all WARN, zero ERROR.** 60 are `authenticated_security_definer_function_executable` (the intended pattern — RLS app with role/capability-checked RPCs), 1 is `extension_in_public` (`pg_trgm` in `public`, cosmetic). **No RLS-disabled, no auth misconfig, no `security_definer_view` errors.** → Not a launch blocker.
- **Migration state:** prod's last applied migration is **`168_revoke_money_mover_rpc_authenticated`** (2026-06-02). The repo contains **`169_unique_oe_number_active_parts`, `170_fix_po_notification_links`, `171_approval_threshold_description_copy`** which are **NOT in the applied list.** → **ACTION: apply 169–171 to prod.**
- **Old "migration 127" gate:** does not appear in tracking (it was Dashboard-applied), but later **applied** storage-RLS migrations supersede it — `car_documents_storage_rls_fix` and `gate_customer_documents_to_capability` (both 2026-05-25). Confirm with Appendix A query #1.

## Could not auto-run (needs your approval) — run in Supabase SQL editor
The `execute_sql` tool requires a manual approval that didn't come through, so these two read-only checks are pending. SQL in **Appendix A**:
1. Storage doc policies (confirms 127/scoping is in place).
2. The **$999M test cash session** (CASH-01) so you can see exactly what to remove.

---

## What's left — checklist (private internal launch)

**🔴 Do before real use**
- [ ] Apply migrations **169, 170, 171** to prod.
- [ ] Clean QA/test data (data task — not code): the **$999M cash session** (CASH-01), the test cars all dated 2026-02-20, test suppliers/POs/refunds, "Test Brake Pad", QA recall.
- [ ] Confirm **Vercel prod env secrets**: Supabase URL + anon/service keys, **Anthropic** key (AI chat), **Sentry** DSN (errors + feedback button).

**🟠 Decision**
- [ ] **Price removal** (car sale / repair-fix / customer-refund prices). Recommended: do **Phase A (UI removal) before go-live** so staff never see/enter sale prices. Plan: `docs/price-removal-plan.md` (branch `claude/price-removal-plan`).

**🟡 Verify**
- [ ] Confirm the **"freeze"** (Installments/Suppliers/Warranty first-load) is not real — one React Profiler trace settles it.

**🟢 Optional / post-launch**
- [ ] Enable **Vercel Deployment Protection** (password/SSO) for extra privacy.
- [ ] Cash closing-balance sanity bound (CASH-01), anonymous-test-drive confirm (DRIVE-02), audit §6 backlog.

---

## Privacy posture (since this is private/internal)
- Every page is behind **Supabase login** + `SessionEnforcer` + **forced password change on first login**. The Vercel URL is reachable but useless without a provisioned account — that is the privacy boundary.
- Optional defense-in-depth: **Vercel Deployment Protection** so even the login page isn't publicly reachable.
- No app-store / marketing / scaling concerns apply.

## Merged in this session
#173 (notif count), #174 (speed-dial FAB), #175 (installments criticals), #176 (toast-on-back), #177 (installments perf), #178 (test-drive toast) — plus this week's QA/polish (text-selection, copyable values, skeletons, dark mode).

---

## Appendix A — verification SQL (read-only)
```sql
-- 1. Storage doc policies (expect scoped customer/job/car document policies;
--    the old wide-open "Auth users can upload/view ..." should be gone)
select polname from pg_policy
where polrelid = 'storage.objects'::regclass
order by polname;

-- 2. CASH-01: the absurd-variance test session(s) to clean up
select id, business_date, opening_balance, closing_actual, variance, status, notes
from cash_sessions
where abs(coalesce(variance,0)) > 1000000
order by abs(variance) desc;
```
