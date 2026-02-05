# Monza Tech CRM — Web App

Internal-only Next.js app for car inventory. No external customers; staff use only.

## Setup

1. **Env**  
   Copy `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **RLS**  
   Current Supabase policies use `TO authenticated`. To use this app **without login** (e.g. internal testing), run the optional SQL in the repo root: `supabase/migrations/` or add policies that allow `anon` for `cars`, `car_events`, and the views. For production, use Supabase Auth so staff sign in and are `authenticated`.

3. **Run**

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Go to **Cars** to use the inventory loop.

## Loop

1. **Cars list** (`/cars`) — Filters (VIN, status, location), table, View / Add Car.
2. **Add car** (`/cars/add`) — Form: VIN, brand, model, year, colors, location, status, date arrived. On submit → car profile.
3. **Car profile** (`/cars/[id]`) — Overview (current state), Movement/Status history. **Move location** opens the move modal.
4. **Move car** — Modal: new location + slot, optional status, note. Uses Supabase RPC `move_car` (updates car + logs event).

## Stack

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui
- Supabase (Postgres, RLS, RPC `move_car`)
