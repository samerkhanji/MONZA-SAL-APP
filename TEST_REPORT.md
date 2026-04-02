# Monza CRM – Full Test Report

**Date:** February 13, 2025  
**Scope:** App structure, Supabase, PWA, security, lint, improvements

---

## 1. Build & Lint Status

| Check | Status |
|-------|--------|
| `npm run build` | ✅ Passes |
| `npm run lint` | ⚠️ Warnings (see below) |

---

## 2. Supabase

**Database is managed in the Supabase Dashboard.** No migrations are run from this project. The app connects as a client only and never modifies the schema.

---

## 3. RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| cars | authenticated | authenticated | authenticated | — |
| car_events | authenticated | authenticated | — | — |
| customers | authenticated | authenticated | authenticated | — |
| parts | authenticated | owner/sales/garage_manager | owner/sales/garage_manager | owner only |
| garage_jobs | authenticated | authenticated | authenticated | authenticated |
| profiles | authenticated | — | own / owner | owner |

---

## 4. PWA & auth proxy (`src/proxy.ts`)

Matcher excludes static/PWA paths so the auth edge layer does not intercept them.

| Item | Status |
|------|--------|
| manifest.json | ✅ Excluded from proxy matcher |
| sw.js | ✅ Excluded from proxy matcher |
| /icons/* | ✅ Excluded from proxy matcher |
| /images/* | ✅ Excluded from proxy matcher |
| Service worker | ✅ Registered in layout |
| Install banner | ✅ Dashboard, dismissible |
| Install dropdown | ✅ User menu |

---

## 5. ESLint Findings

### setState in effect (react-hooks/set-state-in-effect)

Several pages call `setState` directly in `useEffect` (e.g. `setLoading(true)`, `fetchData()`). The rule flags this for possible cascading renders. Common patterns:

- `cars/page.tsx`, `cars/[id]/page.tsx`
- `customers/page.tsx`, `customers/[id]/page.tsx`
- `garage/*`, `documents/page.tsx`, etc.

**Recommendation:** Consider `useTransition` or moving data fetching to server components where possible. For now, these patterns are acceptable for client-side data loading.

### Missing dependencies (react-hooks/exhaustive-deps)

Several `useEffect` hooks omit `fetchCars`, `fetchCustomer`, etc. from the dependency array. Adding them can cause infinite loops if not memoized with `useCallback`.

**Recommendation:** Wrap fetch functions in `useCallback` and add them to the dependency array, or add an `eslint-disable-next-line` with a short comment where the current behavior is intentional.

---

## 6. Security Notes

1. **Auth:** `web/src/proxy.ts` runs session refresh via `updateSession` in `web/src/lib/supabase/middleware.ts`; unauthenticated users are redirected to `/` (login). Public routes: `/`, `/login`, `/reset-password`.
2. **PWA assets:** `/manifest.json`, `/sw.js`, `/icons/*`, `/images/*` are public.
3. **Storage:** `car-documents` bucket policies require authenticated users.
4. **Parts:** INSERT/UPDATE limited to owner, sales, garage_manager; DELETE to owner only.

---

## 7. Improvements Done

1. Removed unused `garageVisitsCount` and `maintenanceCount` in `cars/[id]/page.tsx`.
2. Deleted migration files — database is managed in Supabase Dashboard.

---

## 8. Suggested Next Steps

1. **Lint:** Gradually fix `setState` in effects and dependency arrays.
2. **Storage:** Add a `job-documents` bucket if job document uploads are used.
3. **Tests:** Add E2E tests for critical flows (login, add car, add customer).
4. **Next.js:** Root `middleware.ts` removed; use `src/proxy.ts` only (Next.js 16+). Supabase logic stays in `src/lib/supabase/middleware.ts`.
