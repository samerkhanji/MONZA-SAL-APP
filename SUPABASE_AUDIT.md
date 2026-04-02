# Supabase Connection Audit

**Date:** February 2025  
**Scope:** Tables, RPCs, storage, auth, env, potential issues

---

## 1. Environment Variables

| Variable | Required | Used By |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | client.ts, `lib/supabase/middleware.ts` (via `proxy.ts`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | client.ts, `lib/supabase/middleware.ts` (via `proxy.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ No | Not used (only in .env.example) |

**Action:** Ensure `web/.env.local` has valid `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API.

---

## 2. Tables & Views (must exist in Supabase)

| Name | Type | Used In |
|------|------|---------|
| `cars` | table | cars page, add, edit, move, garage |
| `cars_display` | view | cars list, dashboard, documents |
| `car_events` | table | car history, dashboard, settings audit |
| `car_documents` | table | car-documents, car-day-detail-dialog |
| `customers` | table | customers, status-customer-dialog |
| `customers_display` | view | customers list, customer [id] |
| `sales_orders` | table | status-customer-dialog, cars/add |
| `profiles` | table | UserContext, settings, EditTeamMember |
| `parts` | table | garage inventory, jobs, stock movement |
| `part_movements` | table | PartHistoryDialog, settings audit |
| `garage_jobs` | table | garage, jobs [id] |
| `job_parts` | table | garage jobs [id] |
| `job_documents` | table | JobDocuments component |
| `customer_notes` | table | CustomerNotes, settings audit |
| `customer_documents` | table | CustomerDocuments |
| `system_preferences` | table | settings page (company, prefs) |

---

## 3. RPC Functions (must exist in Supabase)

| Function | Parameters | Used In |
|----------|-------------|---------|
| `move_car` | p_car_id, p_new_location_type, p_new_location_slot, p_new_location_floor, p_new_status, p_note, p_user_id | move-car-dialog |
| `create_car` | p_vin, p_brand, p_model, p_model_year, p_exterior_color, p_interior_color, p_location_type, p_location_slot, p_location_floor, p_status, p_user_id | cars/add |
| `use_part_on_job` | p_job_id, p_part_id, p_quantity, p_note, p_user_id | garage jobs [id], NewJobDialog |
| `move_part_stock` | p_part_id, p_movement_type, p_quantity, p_car_id, p_job_description, p_note, p_user_id | StockMovementDialog |

---

## 4. Storage Buckets (must exist in Supabase)

| Bucket | Used In |
|--------|---------|
| `car-documents` | car-documents.tsx, car-day-detail-dialog.tsx |
| `job-documents` | JobDocuments.tsx |
| `customer-documents` | CustomerDocuments.tsx |

**Action:** Create these buckets in Supabase Dashboard → Storage if missing. Set RLS policies for authenticated users (upload, read, delete).

---

## 5. Cars Table Extra Columns (app uses these)

The app reads/writes these columns. Ensure they exist in your `cars` table:

| Column | Type | Used In |
|--------|------|---------|
| `is_erev` | boolean | cars/add, cars/[id], edit-car-dialog |
| `ev_km` | integer | cars/add, cars/[id], edit-car-dialog |
| `motor_km` | integer | cars/add, cars/[id], edit-car-dialog |

---

## 6. system_preferences Table

Expected schema:

- `key` (TEXT, primary key)
- `value` (TEXT)
- `updated_by` (UUID, nullable)
- `updated_at` (TIMESTAMPTZ)

Upsert uses `onConflict: "key"`.

---

## 7. customer_documents Table

Used by CustomerDocuments. Expected: metadata for uploaded files (id, customer_id, document_type, file_name, file_path, etc.) with RLS for authenticated users.

---

## 8. Issues Found

### 8.1 Move Car: `p_user_id` always null

**File:** `web/src/components/move-car-dialog.tsx`  
**Issue:** `move_car` RPC is called with `p_user_id: null`, so `car_events` will have `created_by = null` for move events.  
**Fix:** Get current user and pass `user?.id` so move events are attributed.

### 8.2 Unused server.ts

**File:** `web/src/lib/supabase/server.ts`  
**Issue:** `createServerClient` is never imported. The app uses `createClient` from client.ts everywhere.  
**Note:** Keep if you plan to use Server Components with Supabase; otherwise remove.

### 8.3 Edge session (proxy + lib): silent fail when env missing

**Files:** `web/src/proxy.ts` → `web/src/lib/supabase/middleware.ts` (`updateSession`)  
**Issue:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing, `updateSession` returns `NextResponse.next()` without auth check. Users could access protected routes.  
**Recommendation:** In development, log a warning. In production, ensure env vars are set.

---

## 9. Connection Flow Summary

1. **Client:** `createClient()` from `@/lib/supabase` → `createBrowserClient` (SSR) with cookies.
2. **Edge:** `proxy.ts` invokes `updateSession` in `lib/supabase/middleware.ts` — `createServerClient` with request cookies for session refresh and auth redirect.
3. **Auth:** `supabase.auth.getUser()`, `signInWithPassword`, `signOut`, `updateUser`, `onAuthStateChange`. Forgot-password uses `POST /api/auth/reset-password`, not client-side GoTrue recovery.
4. **Data:** All queries use the browser client. No server-side Supabase client in use.

---

## 10. Checklist for Supabase Dashboard

- [ ] Tables/views listed in §2 exist
- [ ] RPC functions in §3 exist with correct signatures
- [ ] Storage buckets in §4 exist with RLS
- [ ] `cars` has `is_erev`, `ev_km`, `motor_km` if using EREV features
- [ ] `system_preferences` exists with key/value schema
- [ ] `customer_documents` exists
- [ ] RLS policies allow authenticated users where needed
- [ ] Auth providers (email/password) configured
