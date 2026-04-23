# Supabase Migrations

This folder is the source of truth for the database schema going forward.

## How to make schema changes

1. `supabase migration new <short_snake_name>` — creates a timestamped file you edit.
2. `supabase db push` — applies it to the linked remote project.
3. Commit the file together with any code changes that depend on the new schema.

Avoid editing the database via the Dashboard — changes made there won't appear here,
which recreates the drift problem this folder was set up to solve.

## Baseline from the live DB

`_archive/` contains 52 older reference-only SQL files that documented the intended
schema but were never run through the CLI. They're kept for historical context only;
do not import them.

The real baseline — reflecting what's currently on
`https://okxpsvukzjjubinhamek.supabase.co` — needs to be pulled once Docker Desktop is
running:

```bash
# From the repo root, with Docker Desktop running:
supabase db dump --linked --schema public,api \
  -f supabase/migrations/$(date +%Y%m%d%H%M%S)_baseline.sql
git add supabase/migrations
git commit -m "chore(db): baseline from live project"
```

After that one-time commit, the repo and the live project are aligned. Every future
change flows through `supabase migration new` + `supabase db push` and never drifts
again.

## Remote migrations applied during the audit

These exist in `supabase_migrations.schema_migrations` on the live DB (plus 2
pre-existing from 2026-04-09):

- `20260420132715` — initial live security hardening
- `20260420135100` — missing tables (system_events, task_timers, page_access_requests, …)
- `20260420135119` — rename time_entries → job_time_entries, proposal_items → repair_proposal_items
- `20260420135243` — drop snapshot cols + dead tables + view rewrites
- `20260420140428` — FK cascades + requests simplification + shipping_eta_* drop
- `20260420141019` — drop profiles.role (handle_new_user rewritten)
- `20260423130124` — orphan table + view cleanup + profiles.department_id drop
- `20260423133017` — MFA RESTRICTIVE + trigger consolidation + FK indexes + search_path hardening

`supabase db dump --linked` will collapse all of these (and the 2 older ones) into one
canonical baseline.
