# Monza Tech CRM — Web App

Internal-only Next.js app for car inventory. No external customers; staff use only.

## Setup

1. **Env**  
   Copy `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Auth**  
   All users must sign in before accessing the CRM. Create staff users in the [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Users, or enable email signup if needed. RLS policies use `TO authenticated` — signed-in users have full access.

3. **Run**

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). You will be redirected to **Login** — sign in with your Supabase Auth credentials, then access the car inventory.

## Loop

1. **Cars list** (`/cars`) — Filters (VIN, status, location), table, View / Add Car.
2. **Add car** (`/cars/add`) — Form: VIN, brand, model, year, colors, location, status, date arrived. On submit → car profile.
3. **Car profile** (`/cars/[id]`) — Overview (current state), Movement/Status history. **Move location** opens the move modal.
4. **Move car** — Modal: new location + slot, optional status, note. Uses Supabase RPC `move_car` (updates car + logs event).

## Stack

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui
- Supabase (Postgres, RLS, RPC `move_car`)
