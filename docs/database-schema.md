# Monza CRM — Database Schema (Supabase)

> This document summarizes the main tables, relationships, and security rules in the Monza CRM Supabase project. For exact definitions, see the SQL in `supabase/migrations/`.

---

## Overview

- **Engine**: PostgreSQL (Supabase)
- **Access**: Supabase REST, Realtime, and RPC
- **Auth**: Supabase Auth (`auth.users`) + `profiles` table
- **Security**: Row-Level Security (RLS) enabled on application tables

High-level domains:

- **Inventory**: `cars`, `cars_display`, warranty and status fields
- **CRM**: `customers`, `requests`
- **Sales**: `sales_orders`, installments-related tables
- **Garage**: `garage_jobs`, `parts_inventory`, movement/history tables
- **Users / Roles**: `profiles`, capabilities, RLS policies

---

## Core Tables

### `cars`

Represents each vehicle in Monza’s inventory.

- **Key columns (partial)**:
  - `id uuid PK`
  - `vin text UNIQUE NOT NULL` — primary vehicle identifier
  - `status car_status` — enum (`inbound`, `in_stock`, `showroom`, `reserved`, `sold`, `delivered`, `service`, `sent_to_sub_dealer`, `demo`, `registered`, `under_registration`, `sent_to_customs`, `company_car`)
  - `location_type location_type` — enum (`showroom1`, `showroom2`, `garage`, `storage`, `inventory`)
  - `location_slot text`
  - `brand text`
  - `model text`
  - Warranty fields (vehicle & battery), customs fields
  - **Legacy fallback fields**:
    - `client_name text`
    - `client_phone text`

- **Invariants**:
  - `vin` is globally unique.
  - `client_name` and `client_phone` are **read-only legacy fields**; new flows must not write to them.
  - Canonical customer linkage is via `sales_orders` (see below).

- **Important relationships**:
  - Referenced by `sales_orders.car_id`.
  - Referenced by garage/job tables for service history.

---

### `customers`

Represents people or companies buying/reserving vehicles.

- **Key columns (partial)**:
  - `id uuid PK`
  - `full_name text`
  - `phone_primary text`
  - `email_primary text`
  - Address and notes fields

- **Relationships**:
  - `sales_orders.customer_id` → `customers.id`
  - Customer docs/notes tables (where present) reference `customers.id`.

---

### `sales_orders`

Connects cars and customers and encodes the sales lifecycle.

- **Key columns (partial)**:
  - `id uuid PK`
  - `car_id uuid FK → cars.id`
  - `customer_id uuid FK → customers.id`
  - `status text` — e.g. draft, reserved, sold, delivered, cancelled
  - `created_at timestamptz`
  - Links to payment plans / installments (see installments tables)

- **Invariants**:
  - For **displaying customer info for a car**:
    - Prefer following `sales_orders` → `customers`.
    - Only fall back to `cars.client_name` / `cars.client_phone` when no order exists.

---

### `profiles`

Application-level user profiles, joined to Supabase Auth.

- **Key columns (partial)**:
  - `id uuid PK` — matches `auth.users.id`
  - `full_name text`
  - `email text` — synced from `auth.users.email`
  - `user_role text` — high-level app role (`owner`, `assistant`, `sales_ops`, `garage_manager`, `garage_staff`, `khalil_hybrid`/`hybrid`, `it`, …)
  - `capabilities user_capability[]` — enum array for granular permissions (e.g. `garage`, `vehicle_software`, `cashier`, `events_ops`)
  - Employment fields: `job_title`, `department`, `employment_status`, `terminated_at`, `termination_reason`
  - Audit fields: `created_by`, `updated_by`, `updated_at`

- **Invariants**:
  - `profiles.user_role` is the **single source of truth** for high-level roles.
  - `capabilities` is used for finer-grained checks; any deprecated `capabilities_jsonb` field is no longer authoritative.
  - Email is synchronized from `auth.users` via triggers (see migrations around `024_profiles_email_sync_auth.sql`).

- **RLS** (high level):
  - Users can read and update their own profile.
  - `owner` role can insert/update other profiles (team management).

---

### `parts_inventory`

Tracks spare parts for the garage.

- **Key columns (typical)**:
  - `id uuid PK`
  - `part_number text`
  - `part_name text`
  - `quantity int`
  - `location text`
  - `min_stock int`

- **Relationships**:
  - Garage job line items reference `parts_inventory.id` when parts are used.

---

### `garage_jobs`

Represents service jobs performed on vehicles.

- **Key columns (typical)**:
  - `id uuid PK`
  - `car_id uuid FK → cars.id`
  - `status text` — pending, in_progress, done, etc.
  - `reason_of_visit text`
  - `created_at timestamptz`
  - Relationships to job-part usage tables.

- **Relationships**:
  - Jobs link to `cars` (which car is being serviced).
  - Job documents and notes link back to `garage_jobs.id`.

---

### `requests`

General internal request center.

- **Key columns (typical)**:
  - `id uuid PK`
  - `subject text`
  - `category text`
  - `submitted_by uuid FK → profiles.id`
  - `status text` — open, in_progress, closed, etc.
  - `created_at timestamptz`

- **Relationships**:
  - May join to `profiles` for “submitted by” display (via `profiles.email` / `full_name`).

---

### `cars_display` (view or materialized view)

Convenience view for inventory screens.

- **Purpose**:
  - Flatten core fields from `cars` plus computed labels and joins (e.g. location labels, combined model, maybe sales/customer info).

- **Usage**:
  - `web/src/app/(dashboard)/cars/page.tsx` queries `cars_display` via the data layer (`lib/data/cars.ts`).

---

## Functions, Triggers, and RPC

### RPC: `move_car`

Used by the frontend when moving a car between locations.

- **Responsibilities**:
  - Update `cars.location_type`, `location_slot`, `status`, etc.
  - Insert a row into a car events/history table tracking movement.

### Email / profile sync triggers

Migrations such as `024_profiles_email_sync_auth.sql` and `025+` introduce:

- Triggers to keep `profiles.email` synchronized with `auth.users.email`.
- Triggers to maintain `profiles.updated_at` and audit columns.

### Employee management triggers

Later migrations (e.g. `026_profiles_rls_owner_update.sql`) configure:

- RLS policies so that:
  - Owners can insert/update other profiles.
  - Employees can update their own profile fields safely.

---

## Row-Level Security (RLS) Summary

> Exact SQL lives in `supabase/migrations/0xx_*.sql`. This section is a conceptual overview.

- **General**
  - RLS is enabled on key tables (e.g. `profiles`, `cars`, `customers`, `sales_orders`, `garage_jobs`, `requests`).
  - Policies generally check:
    - `auth.uid()` (current user id)
    - `profiles.user_role` and `profiles.capabilities`

- **Profiles**
  - Policy allowing users to select/update their own profile by `id = auth.uid()`.
  - Policy allowing `owner` role to select/insert/update any profile.

- **Cars**
  - All authenticated users can typically read `cars` / `cars_display` (with possible restrictions).
  - Only certain roles (`owner`, `sales_ops`, possibly `it`) can insert or soft-delete (`deleted_at`).
  - Garage roles can update service-related fields but not legacy client data.

- **Sales Orders / Customers**
  - Sales-related roles have read/write access.
  - Policies ensure users cannot touch data outside their Monza project boundaries.

- **Garage Jobs / Parts**
  - Garage roles can read/write jobs and parts inventory.
  - Non-garage roles usually have read-only or no access.

- **Requests**
  - Owners and assistants can see broader sets of requests.
  - Other roles see only requests they submitted or those targeted to them.

---

## How to Extend Safely

When adding new tables or columns:

1. **Define clear ownership**:
   - Which role(s) should read/write?
   - Is the data tied to a `car`, `customer`, or `profile`?

2. **Add migrations** in `supabase/migrations/`:
   - Create tables, enums, indexes.
   - Add RLS policies that reuse the existing role model (`profiles.user_role`, `capabilities`).

3. **Document changes**:
   - Update this `database-schema.md` with new tables/columns.
   - Note any new invariants or relationships.

4. **Keep legacy fields read-only**:
   - Any new flow involving customers and cars must:
     - Use `customers` + `sales_orders`.
     - Avoid writing to `cars.client_name` and `cars.client_phone`.

This discipline keeps Monza CRM maintainable as it grows across inventory, CRM, sales, garage, and analytics domains.

