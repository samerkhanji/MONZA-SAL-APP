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

## 2. Supabase Audit

### Migrations (16 files)

| Migration | Purpose |
|-----------|---------|
| 001 | cars, car_events, RLS, move_car, create_car |
| 002 | customers, sales_orders, reservations, pdi_reports |
| 003 | Simplify tables, drop reservations/pdi_reports |
| 004 | Schema refinements, soft-delete, cars_display |
| 005 | **Optional anon policies** – do not run if using Auth |
| 006 | Price, warranty, customs on cars |
| 007 | Car statuses: sent_to_sub_dealer, demo |
| 008 | Customs amount paid |
| 009 | Sub dealer name |
| 010 | Location floor, inventory |
| 011 | Warranty DMS/Monza dates |
| 012 | Car documents, storage policies |
| **012_add_parts_profiles_garage** | **NEW** – profiles, parts, garage_jobs, job_parts, job_documents, part_movements |
| 013 | Event date on car_documents |
| 014 | RLS on parts |
| 015 | Role-restricted parts policies |
| 016 | car_events FK to profiles |

### Critical: Migration 005

Migration `005_optional_anon_internal.sql` replaces authenticated policies with anon policies. **Do not run this if the app uses Supabase Auth.** The Monza CRM app uses Auth; this migration should be skipped.

### New Migration: 012_add_parts_profiles_garage

Adds tables that the app expects but were not in migrations:

- **profiles** – User roles (owner, sales, garage_manager, assistant), required for 016
- **parts** – Parts inventory, required for 014/015
- **part_movements** – Stock movements
- **garage_jobs** – Garage jobs linked to cars
- **job_parts**, **job_documents** – Job-related data

Runs after `012_add_car_documents` (alphabetically) and before 014.

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

## 4. PWA & Middleware

| Item | Status |
|------|--------|
| manifest.json | ✅ Excluded from middleware |
| sw.js | ✅ Excluded from middleware |
| /icons/* | ✅ Excluded from middleware |
| /images/* | ✅ Excluded from middleware |
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

1. **Auth:** Middleware redirects unauthenticated users to `/` (login). Public routes: `/`, `/login`, `/reset-password`.
2. **PWA assets:** `/manifest.json`, `/sw.js`, `/icons/*`, `/images/*` are public.
3. **Storage:** `car-documents` bucket policies require authenticated users.
4. **Parts:** INSERT/UPDATE limited to owner, sales, garage_manager; DELETE to owner only.

---

## 7. Improvements Done

1. Added `012_add_parts_profiles_garage.sql` for profiles, parts, garage.
2. Clarified migration 005 with a warning comment.
3. Removed unused `garageVisitsCount` and `maintenanceCount` in `cars/[id]/page.tsx`.

---

## 8. Suggested Next Steps

1. **Migration 005:** If it was already applied, add a migration to restore authenticated policies for cars and car_events.
2. **Lint:** Gradually fix `setState` in effects and dependency arrays.
3. **Storage:** Add a `job-documents` bucket if job document uploads are used.
4. **Tests:** Add E2E tests for critical flows (login, add car, add customer).
5. **Next.js:** Review middleware deprecation warning (middleware → proxy).
