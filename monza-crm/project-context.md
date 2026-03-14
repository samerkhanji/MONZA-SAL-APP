---
project_name: 'MONZA-CRM'
user_name: 'SK'
date: '2026-03-12'
sections_completed: ['technology_stack']
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16.1.6 |
| React | React | 19.2.3 |
| Language | TypeScript | ^5 |
| Database/Auth | Supabase | @supabase/ssr ^0.8.0, @supabase/supabase-js ^2.93.3 |
| Styling | Tailwind CSS | ^4 |
| UI Components | Radix UI | ^1.4.3 |
| Utilities | class-variance-authority, clsx, tailwind-merge | cva ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.4.0 |
| Icons | Lucide React | ^0.563.0 |
| Other | date-fns, sonner (toast), xlsx, html5-qrcode, tesseract.js, web-push | Various |

**Project structure:**
- `web/` — Next.js app (App Router)
- `supabase/` — migrations, SQL
- Path alias: `@/*` → `./src/*`

---

## Critical Implementation Rules

### 1. Legacy Car Fields (DO NOT REVERT)

`cars.client_name` and `cars.client_phone` are **read-only legacy fallback fields**. Never write to them.

**Source of truth:** `cars → sales_orders → customers`

**All new sales flows must:**
1. Create or update a **customer**
2. Create a **sales_order** with `car_id` and `customer_id`
3. Link the car via `sales_orders.car_id`
4. Update car **status** only (no legacy fields)

**Display logic:** If `sales_order.customer` exists → show relational customer data. Else → show legacy `client_name` (and `client_phone` if present) as fallback.

### 2. Supabase Profiles Join Pattern

When Supabase returns joined `profiles` (e.g. `profiles:submitted_by(full_name)`), PostgREST may return it as an array.

**Required pattern:**
```typescript
const reqList = (requestsWithProfiles.data ?? []).map((r: any) => ({
  id: r.id,
  subject: r.subject,
  // ...other fields
  profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
}));
```

**Rules:**
- DO NOT use `as Array<{...}>` type assertions
- DO use `(r: any)` for the map callback parameter
- DO normalize profiles: `Array.isArray(r.profiles) ? r.profiles[0] : r.profiles`

### 3. Supabase Client Usage

- **Client components:** `import { createClient } from "@/lib/supabase"` → uses `createBrowserClient` from `@supabase/ssr`
- **Server components / API routes:** `import { createClient } from "@/lib/supabase/server"` → uses `createServerClient` with cookies
- **Admin operations (e.g. Add Employee):** Use `createClient(url, serviceRoleKey)` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`

### 4. Permissions & Roles

- `AppRole` types: `owner`, `assistant`, `khalil_hybrid`, `it`, `garage_manager`, `garage_staff`, `sales_ops`
- Page access: `canAccessPage(page, role)` from `@/lib/permissions`
- CRUD: `canPerform(entity, action, role)`
- RLS: Owners use `user_role = 'owner'`; `capabilities` is a `user_capability[]` enum array (garage, vehicle_software, cashier, events_ops)

### 5. Code Conventions

- **Imports:** Use `@/` alias for all internal imports (e.g. `@/lib/supabase`, `@/components/ui/button`)
- **Styling:** Use `cn()` from `@/lib/utils` for conditional Tailwind classes (clsx + tailwind-merge)
- **UI components:** Radix UI primitives with CVA variants (see `button.tsx` pattern)
- **File naming:** PascalCase for components, kebab-case for routes/pages

### 6. Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required for client
- `SUPABASE_SERVICE_ROLE_KEY` — required for Add Employee and other admin flows (server-only)

---

## Key Areas for Context Rules

- TypeScript strict mode (enabled in tsconfig)
- Supabase RLS and profiles join patterns
- Legacy car/customer data model (read-only fallbacks)
- Role-based permissions (PAGE_PERMISSIONS, CRUD_PERMISSIONS)
- Next.js App Router with server/client component separation
