# Monza Tech CRM — Web App

Internal-only Next.js app for Monza S.A.L. staff. No external customers; staff use only.

---

## Local development

### 1. Environment variables

Create `web/.env.local` with at least:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anonymous public key

For some admin/server flows you may also need:

- `SUPABASE_SERVICE_ROLE_KEY` — **server-side only**, used in API routes (e.g. Add Employee)

### 2. Install & run

From the repo root:

```bash
cd web
npm install
npm run dev
```

Then open **`http://localhost:3000`** (or `http://127.0.0.1:3000`).  
You will be redirected to **Login** — sign in with your Supabase Auth credentials.

### Dev: HMR / “page keeps reloading” / WebSocket errors

If the console shows `WebSocket ... /_next/webpack-hmr ... ERR_INVALID_HTTP_RESPONSE`:

1. **Use localhost, not a WSL/Docker LAN IP** — `http://172.20.x.x:3000` often appears when Next prints “Network” URL on Windows+WSL. Prefer **`http://localhost:3000`** so the browser and HMR use the same host (WSL port forwarding is more reliable for `localhost`).
2. **Proxies** — nginx, Cloudflare Tunnel, etc. must forward **WebSocket** upgrades (`Connection: upgrade`, `Upgrade: websocket`). Plain HTTP reverse proxies without that break HMR.
3. **Clear cache** — stop dev server, delete `web/.next`, run `npm run dev` again.
4. **LAN / phone** — set `NEXT_DEV_ALLOWED_ORIGINS=http://YOUR_LAN_IP:3000` in `.env.local` if you need a non-localhost origin (see `next.config.ts`).

This repo’s Next.js **proxy** (`src/proxy.ts`) intentionally skips all `/_next/*` routes so dev HMR is not intercepted by auth. Session refresh and redirects live in `src/lib/supabase/middleware.ts` (`updateSession`), which `proxy.ts` calls.

### 3. Tests

Vitest is configured:

```bash
cd web
npm test
```

---

## Core modules

- **Cars / Inventory**
  - `/cars` — list with filters (VIN, status, location, brand)
  - `/cars/add` — add a new car
  - `/cars/[id]` — car details, history, movement

- **Customers**
  - `/customers` — list and search customers
  - `/customers/add` — add a new customer
  - `/customers/[id]` — customer profile, notes, documents

- **Sales / Installments**
  - `/installments` — manage payment plans and installments
  - `sales_orders` in Supabase link cars to customers

- **Garage**
  - `/garage` — active jobs overview
  - `/garage/inventory` — parts inventory
  - `/garage/jobs/[id]` — job details, parts usage
  - `/garage/history` — completed jobs / history

- **Requests & Documents**
  - `/requests` and `/requests/pending` — internal request center
  - `/documents` — document listing

- **Settings & Data Health**
  - `/settings` — team management (profiles, roles, capabilities)
  - `/data-health` — data integrity and health dashboards

---

## Stack

- **Frontend**
  - Next.js 16 (App Router)
  - React 19
  - TypeScript
  - Tailwind CSS 4
  - Radix UI + shadcn-style components
  - Sonner toasts, Lucide icons

- **Backend**
  - Supabase Postgres
  - Supabase Auth
  - RLS policies defined in Supabase (documented via migrations)
  - RPCs such as `move_car` for complex operations

---

## Architecture & database docs

- **System architecture**: see [`../docs/architecture.md`](../docs/architecture.md)
- **Migrations**: see [`../supabase/migrations/README.md`](../supabase/migrations/README.md)

Recommended future doc:

- `../docs/database-schema.md` — describe all tables, triggers, RLS policies, and functions to make the data model explicit for humans and AI assistants.

