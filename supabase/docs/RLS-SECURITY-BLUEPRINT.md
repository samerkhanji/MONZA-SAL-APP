# Monza App — RLS security blueprint

Use this when you (or AI) author **exact SQL** for a full RLS rollout: keep policies **aligned with the app** (`web/src/lib/permissions.ts`) so the UI does not show actions that the database then rejects.

## 1. Role model (database)

Enum: `public.user_role` (see migration `014_rbac_user_roles_and_requests.sql`):

| Enum value        | Typical use |
|-------------------|-------------|
| `owner`           | Full org access |
| `assistant`       | Requests to owners, installments, garage visibility, etc. |
| `sales_ops`       | Customers, cars CRUD (with owner), installments |
| `garage_manager`  | Garage jobs, parts inventory management |
| `garage_staff`    | Assigned jobs, parts read, VIN lookup |
| `khalil_hybrid`   | Cross-cutting (requests, parts, cars per app) |
| `it`              | IT-tagged requests, parts, etc. |

## 2. Your four buckets → DB roles

You asked for structure by **owner / manager / assistant / garage**. In this codebase **“manager” is not one enum** — split by domain:

| Your label   | Maps to `user_role` | Notes |
|--------------|---------------------|--------|
| **Owner**    | `owner` | |
| **Assistant**| `assistant` | |
| **Manager**  | **`sales_ops`** (sales/customers/cars/installments) **and/or** **`garage_manager`** (garage/parts) | Use separate policy lines; do not merge if permissions differ. |
| **Garage**   | `garage_manager`, `garage_staff` | Garage staff still need **`cars` SELECT** (and often **`parts`**) for VIN scan + job embeds even though they may not have the Cars *page*. |

Extra roles that must keep working: **`khalil_hybrid`**, **`it`** — mirror the arrays in `PAGE_PERMISSIONS` / `CRUD_PERMISSIONS`.

## 3. Helper functions (use in policies)

After migration **`027_rls_helper_functions.sql`**:

- `public.get_my_user_role()` — current user’s `profiles.user_role`
- `public.is_role('owner')` — single role
- `public.is_any_role(ARRAY['owner','assistant']::public.user_role[])` — set membership
- `public.get_my_user_role_resolved()` / `public.is_any_role_resolved(...)` — same but falls back from legacy `profiles.role` when `user_role` is null

**Security:** `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE` only to `authenticated`.

## 4. Tables & current posture (audit before changing)

| Area | Table(s) | Notes |
|------|-----------|--------|
| Inventory | `cars`, `car_events` | Today: permissive “any authenticated” read/write — **tighten** to match `CRUD_PERMISSIONS.cars` + garage VIN/join needs |
| Requests | `requests`, `request_attachments`, `request_notifications` | Mixed old wide policies + `014` role visibility — **reconcile** so SELECT/UPDATE match |
| Garage | `garage_jobs`, `job_parts`, `parts`, job docs if any | `garage_jobs` had **SELECT only** in `014` — confirm **INSERT/UPDATE/DELETE** policies exist in prod or add them |
| Sales | `customers`, `sales_orders` | Often **no RLS** in migrations — **enable + policies** if exposing via PostgREST |
| Installments | `payment_plans`, `installment_payments` | Uses `is_any_role` — **027 required** |
| HR / settings | `profiles` | Owner updates; authenticated read — see `025` / `026` |
| Misc | `delete_requests`, notifications, warranty tracking | Already partial RLS |

## 5. Safe rollout checklist

1. Run migrations on **staging** first; smoke-test each role (owner, assistant, sales_ops, garage_manager, garage_staff, khalil_hybrid, it).
2. Use **separate policies per command** (`SELECT` / `INSERT` / `UPDATE` / `DELETE`) where Postgres requires it.
3. **`service_role`** bypasses RLS — server routes using it are not a substitute for locking the client.
4. After changing `profiles` policies, verify **no recursion**: prefer `SECURITY DEFINER` helpers for role reads.
5. **`cars_display`** is a **view** — RLS applies to underlying `cars` / joins; test `select('*')` from the app.

## 6. Paste your SQL here (workflow)

When you have **exact SQL** structured by owner / manager / assistant / garage:

1. Add a new migration under `supabase/migrations/` (e.g. `028_rls_full_rollout.sql`).
2. Start with `BEGIN;` / run in a transaction in SQL editor if not using CLI.
3. For each table: `DROP POLICY IF EXISTS ...` then `CREATE POLICY ...` with clear names, e.g. `cars_select_sales_and_garage`.
4. Share the file or paste the body — we can diff it against this blueprint and `permissions.ts` for regressions.

---

**Status:** `027_rls_helper_functions.sql` adds missing helpers for installment policies and future role-based RLS. Full table-by-table policies can follow in your next migration once you paste the SQL you want applied.
