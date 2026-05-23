# Monza App — Architecture Overview

## System Overview

Monza App is an internal ERP-style web application for Monza S.A.L. It centralizes:

- **Inventory**: vehicles, locations, movement history
- **CRM**: customers, requests, sales funnel
- **Sales**: sales orders, reservations, installments
- **Garage**: jobs, parts, service workflows
- **Operations**: notifications, data-health, user management

The system is built as:

- **Next.js 16 (App Router)** in `web/`
- **TypeScript** across the frontend
- **Supabase** (Postgres + Auth + RLS) in `supabase/`
- **PWA**-enabled client (service worker, install prompts, push)
- Deployed on **Vercel** (Next.js app) with **Supabase** as the managed backend

High level:

- Browser ⇄ Next.js app (Vercel) ⇄ Supabase REST / Realtime

---

## Technology Stack

- **UI / App**
  - Next.js 16 App Router
  - React 19
  - TypeScript
  - Tailwind CSS 4
  - Radix UI + shadcn-style components
  - Lucide icons
  - Sonner toasts

- **Backend / Data**
  - Supabase Postgres
  - Supabase Auth
  - Row-Level Security (RLS) policies
  - SQL migrations in `supabase/migrations/` for documentation and reproducibility

- **PWA**
  - Custom service worker registration
  - Install prompts and install banners
  - Push notifications via `web-push`

- **Deployment**
  - `web/` deployed to Vercel (builds with `next build`)
  - Supabase project hosted and managed separately

---

## Core Entities

This is a simplified view of the main tables and how they relate.

- **cars**
  - Represents a physical vehicle in inventory.
  - Key fields: `id`, `vin`, `status`, `location_type`, `location_slot`, warranty fields, etc.
  - Contains **legacy fallback fields**:
    - `client_name`
    - `client_phone`
  - These legacy fields must not be written to in new code; canonical customer data lives via `sales_orders`.

- **customers**
  - Represents people or organizations buying or reserving vehicles.
  - Key fields: `id`, `full_name`, `phone_primary`, emails, notes, documents.

- **sales_orders**
  - Connects a `car` to a `customer` and captures reservation / sale.
  - Key fields: `id`, `car_id`, `customer_id`, `status`, `created_at`, payment plan links.
  - Drives how inventory is considered reserved / sold / delivered.

- **profiles**
  - Application user profiles, usually linked 1:1 with Supabase `auth.users`.
  - Key fields: `id`, `full_name`, `email`, `user_role`, `capabilities`, employment data.
  - Controls **role-based access** and RLS decisions.

- **parts_inventory**
  - Tracks parts stock levels in the garage.
  - Key fields: `id`, `part_number`, `part_name`, `quantity`, `location`, `min_stock`.

- **garage_jobs**
  - Represents a service job in the garage.
  - Key fields: `id`, `car_id`, `status`, `reason_of_visit`, `created_at`, links to parts usage.

- **requests**
  - General request center for internal operations (e.g., assistance, data fixes).
  - Key fields: `id`, `subject`, `category`, `submitted_by`, `status`, metadata.

---

## Important Relationships

- **cars → sales_orders → customers**
  - A `sales_orders.car_id` references `cars.id`.
  - A `sales_orders.customer_id` references `customers.id`.
  - When showing customer info for a car:
    - Prefer following `sales_orders` to `customers`.
    - If no `sales_orders` exist, fall back to `cars.client_name` / `cars.client_phone`.

- **profiles → role system**
  - Each `profiles` row maps to a Supabase auth user.
  - The `user_role` and `capabilities` columns drive:
    - What pages a user can access.
    - What CRUD actions they can perform.
    - Which rows they are allowed to update under RLS.

---

## Key Invariants

- **VIN as primary vehicle identifier**
  - `cars.vin` is the globally unique identifier for a vehicle.
  - All scan flows and searches should treat VIN as canonical.

- **Legacy car fields are read-only**
  - `cars.client_name` and `cars.client_phone` exist only for backwards compatibility.
  - New flows must **never** write to these fields.
  - Canonical customer data lives in:
    - `customers`
    - `sales_orders.customer_id`

- **Profiles control roles and RLS**
  - `profiles.user_role` is the single source of truth for high-level roles.
  - `profiles.capabilities` (an enum array) enables more granular permissions.
  - RLS policies check these fields rather than any client-side flags.

---

## Auth & RLS Model

### Roles

The app uses an `AppRole` concept in the frontend (derived from `profiles.user_role` and legacy fields). The main roles are:

- **owner**
  - Full administrative access to all modules.
  - Can manage team members, roles, capabilities.
  - Bypasses most RLS restrictions within reason (where safe).

- **assistant**
  - Supports the owner with access to most operational flows.
  - Limited access to some configuration.

- **sales / sales_ops**
  - Focused on sales workflows:
    - Cars list
    - Customers
    - Installments
  - Cannot perform destructive operations outside their scope.

- **garage roles** (e.g. `garage_manager`, `garage_staff`)
  - Operate on:
    - `garage_jobs`
    - `parts_inventory`
    - Related car fields (status, service-related data).
  - Limited abilities in CRM/sales sections.

- **hybrid**
  - A mixed role (`khalil_hybrid` key) used for cross-functional operations.
  - Has both sales and garage-related permissions, but not full owner rights.

> Note: On the database side, roles are enforced primarily through the `profiles.user_role` column and RLS policies; the frontend `AppRole` maps onto this.

### Row-Level Security (RLS)

At a high level:

- **Profiles**
  - Users can read and update their own profile.
  - Owners can manage other profiles (roles, capabilities, employment status).

- **Cars & Inventory**
  - All authenticated users can read car inventory (with some nuances).
  - Only specific roles (e.g. `owner`, `sales_ops`) can create or delete cars.
  - Garage roles can update service-related fields but not ownership or legacy client data.

- **Sales Orders & Customers**
  - Authenticated users with sales-related roles can read/write orders and customers.
  - RLS ensures users cannot access data outside their tenant/project.

- **Requests & Garage Jobs**
  - Requests and jobs are visible to relevant roles only, with updates constrained by RLS.

For exact SQL policies, see `supabase/migrations/` (and a future `docs/database-schema.md`).

---

## App Structure

- **`web/src/app`**
  - App Router routes:
    - `/` — landing / login redirect
    - `/cars`, `/cars/add`, `/cars/[id]`
    - `/customers`, `/customers/add`, `/customers/[id]`
    - `/garage`, `/garage/inventory`, `/garage/jobs/[id]`, `/garage/history`
    - `/requests`, `/requests/pending`
    - `/installments`
    - `/documents`
    - `/settings`
    - `/data-health`
  - `(dashboard)/layout.tsx` wraps all authenticated pages with:
    - `UserProvider`, `InstallProvider`
    - `SessionEnforcer`, `PageAccessGuard`
    - `DashboardShell`, `OnboardingTour`, floating scan button

- **`web/src/lib`**
  - `supabase/` — client and server helpers
  - `data/` — data access helpers (e.g. `data/cars.ts`)
  - `contexts/` — React context providers (user, theme, install)
  - `permissions.ts` — `AppRole` and `PAGE_PERMISSIONS`, `CRUD_PERMISSIONS`

- **`web/src/components`**
  - Reusable UI (buttons, dialogs, tables)
  - Feature-level components (garage dialogs, scanners, status dialogs)

---

## Why This Architecture

This structure is optimized for:

- **Clear boundaries**:
  - Next.js for UI and routing.
  - Supabase for data and auth.
  - Data access isolated in small helpers.

- **Incremental growth**:
  - New modules (e.g. analytics, reporting) can reuse shared patterns.
  - RLS and roles scale as the team and features expand.

- **AI-friendly context**:
  - This document, plus a future `docs/database-schema.md`, gives AI assistants enough structure to safely modify and extend the system.

---

## Next Suggested Doc: `docs/database-schema.md`

To further improve maintainability and AI guidance, the next recommended step is:

- **`docs/database-schema.md`**
  - List all tables, views, and key columns.
  - Describe triggers, functions, and RLS policies.
  - Explain any non-obvious invariants or data migrations.

Having both **architecture** and **database schema** docs will significantly reduce onboarding time and accidental regressions as Monza App grows.

