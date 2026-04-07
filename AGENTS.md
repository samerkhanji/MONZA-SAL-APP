# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Monza CRM is a single Next.js 16 (App Router) application in `web/` backed by a hosted Supabase instance (Postgres, Auth, Storage). There is no separate backend service to run.

### Quick reference

| Action | Command | Working directory |
|--------|---------|-------------------|
| Install deps | `npm install` | `web/` |
| Dev server | `npm run dev` | `web/` |
| Lint | `npm run lint` | `web/` |
| Tests | `npx vitest run` | `web/` |
| Build | `npm run build` | `web/` |

### Environment variables

The dev server and build require a `web/.env.local` with at least:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key

See `/.env.example` for the full list. Without these, the login form will throw a runtime error on submit ("Missing Supabase config"), but the dev server itself starts and serves pages.

### Gotchas

- **Lockfile**: `package-lock.json` exists — always use `npm install`, not yarn/pnpm.
- **Lint errors are pre-existing**: ESLint currently reports ~206 problems (mostly `set-state-in-effect` and `no-require-imports` in legacy scripts). These are not caused by agent changes.
- **Login test is skipped**: `src/app/__tests__/login.test.tsx` has 2 skipped tests (requires Supabase mock setup).
- **Dev server starts without env vars**: `npm run dev` works, pages render, but any Supabase client call (login, data fetch) will error at runtime until valid credentials are in `.env.local`.
- **Node v22**: The VM has Node 22 pre-installed, which matches the project's needs. No version manager switching is required.
