# Supabase Migrations

This folder is the source of truth for the Monza App database schema. It contains 80 migrations applied to the live project `okxpsvukzjjubinhamek` (region eu-central-1) — numbered `053_*` through `132_*` (plus a few suffixed variants like `056b`, `087a-e`, `090b-d`, `093b`, `096b`, `097b`, `098b/c`, `100b`, `107_fix`, `084a/b`).

`main` is the canonical history. The `_archive/` folder holds 52 older reference-only SQL files that documented intended schema before the CLI workflow existed; they are kept for historical context only and **must not be imported**.

---

## How we apply migrations (current workflow)

We do **not** use `supabase db push` from a local CLI. Migrations are applied via the **Supabase MCP server**, which simultaneously:

1. Writes the SQL to the live database (`apply_migration` tool — runs as `postgres`).
2. Writes a parallel SQL file into this folder (`<NNN>_<snake_name>.sql`).
3. Records the migration in `supabase_migrations.schema_migrations` on the live DB.

Typical flow for a new migration:

1. Pick the next free 3-digit number (last applied: `132`). Use `<NNN>_<snake_case_name>.sql`.
2. Draft the SQL — RLS, idempotent constructs, security hardening (see "Required hardening" below).
3. Have the MCP runner apply it (`mcp__<server>__apply_migration` with the chosen name + SQL body). This step writes both the DB and the file.
4. Commit the file with any application code that depends on the schema change.
5. Update `docs/schema.md` if you added a new table, RPC, trigger, enum, or significant CHECK.

Never edit a migration file after it has been applied. To change a previously-applied object, write a **new** migration that does `CREATE OR REPLACE` / `ALTER` / `DROP IF EXISTS`. Renumbering breaks the migration ledger.

---

## Manual exception: `storage.objects` policies

A small class of migrations cannot go through the MCP runner because the runner authenticates as the `postgres` role, which is NOT a member of `supabase_storage_admin` — the owner of `storage.objects`. Attempting to apply such a migration via `apply_migration` returns:

```
ERROR: must be owner of relation objects (42501)
```

The Supabase Dashboard SQL editor escalates to the storage-admin role automatically.

**Procedure for storage-policy migrations:**

1. Write the SQL file in this folder normally (`<NNN>_<name>.sql`).
2. Add a header comment at the top of the file explaining that it must be applied manually, e.g.:

   ```sql
   -- !! APPLY THIS VIA THE SUPABASE DASHBOARD SQL EDITOR.
   -- The MCP migration runner authenticates as `postgres`, which is NOT
   -- a member of `supabase_storage_admin` (the owner of storage.objects).
   -- Running this via `apply_migration` fails with
   -- "must be owner of relation objects (42501)".
   ```

3. Paste the file body into Dashboard → SQL Editor → Run.
4. Record the migration manually in the ledger if you want it tracked (typically not strictly necessary, since the file in this repo is the source of truth).
5. Commit.

Current example: `127_storage_doc_policies_scoped.sql` — tightens `customer-documents` and `job-documents` bucket policies to first-folder-segment scoping.

---

## Migration numbering rules

- 3-digit prefix, snake_case name (e.g. `131_sales_order_delivered_revert_block.sql`).
- Suffix letters (`056b`, `087a-e`, etc.) are allowed for tight follow-up fixes that logically belong to the parent migration. Don't abuse this; prefer a new 3-digit number for anything substantive.
- The next free number is **always** monotonically increasing. Never renumber an applied migration — even if you decide it should logically be earlier. The live `supabase_migrations.schema_migrations` ledger keys on the filename.
- If you have to amend the live DB without a migration (rare, e.g. a one-off backfill), still write a no-op-friendly idempotent migration file documenting what changed so a fresh clone reaches the same state.

---

## Required hardening for new migrations

Idempotent constructs (required so re-runs against the same DB are safe):

- `CREATE OR REPLACE FUNCTION` (not `CREATE FUNCTION`)
- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `DROP CONSTRAINT IF EXISTS` before re-adding a CHECK
- `DROP POLICY IF EXISTS` before re-creating an RLS policy
- `ON CONFLICT DO NOTHING` for seed INSERTs
- Use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for enum-add when you can't use `IF NOT EXISTS`

Security:

- Every SECURITY DEFINER function must include:
  - `SET search_path TO 'public', 'pg_temp';`
  - `REVOKE EXECUTE ON FUNCTION <name>(<sig>) FROM PUBLIC, anon;`
  - Then `GRANT EXECUTE ... TO authenticated;` (or service_role only for internal fns).
- Capability/role guard at the function entry: `_require_any_capability(ARRAY[...]::user_capability[])` or `is_any_role_resolved(ARRAY[...]::user_role[])`.
- `created_by` / `updated_by` columns must be set by a trigger or the RPC body — never trust the caller.
- New tables: `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` plus explicit policies. Default deny is the goal.
- New columns on existing tables: confirm existing RLS doesn't accidentally expose sensitive data via `SELECT *`.

Performance:

- Always index FKs (otherwise `EXPLAIN` will show seq-scans under load).
- For RLS predicates that reference `auth.uid()`, wrap in a stable subselect to allow the planner to cache it: `(SELECT auth.uid())` — see mig 072 for the pattern.

---

## Ledger snapshot (as of 2026-05-19)

Latest applied: `132_sales_order_deposit_requires_quote`. The full sequence:

```
053..068   Phase A — initial hardening (RLS, capabilities, triggers, suppliers/invoices/commissions)
069..098c  Phase B — workflow + reconciliation (notifications V2, crons, approval thresholds, PO, cash)
099..099b  Warranty / Recall / Refund
100..100b  Trade-ins
101..113   QA hot-fixes (anon revoke, CHECK alignment, race fixes, payment plan rpc, etc.)
114..132   Launch sprint (garage_staff RLS, last-owner trigger, auto-cash attach,
           Beirut TZ, state-machine RPCs, GRN audit, storage scoping (127 manual),
           notification + threshold seeds, sales-order revert + deposit-quote CHECKs)
```

See `docs/schema.md` for the per-migration one-line summary.

---

## Obsolete: `supabase db dump --linked` baseline guidance

The previous version of this README described pulling a one-time `supabase db dump --linked --schema public,api > baseline.sql` to align the repo with the live project. **That step was never performed.** Instead, the team chose to:

- Treat each individual migration file as the source of truth (numbered `053+`).
- Apply every change through the MCP runner so the file and the live DB stay in lockstep.
- Leave the legacy 52-file `_archive/` set as documentation only.

Anyone bootstrapping a fresh Supabase instance from scratch should apply migrations `053 → 132` in order via `apply_migration` (and run `127` through the Dashboard manually). There is no consolidated baseline SQL file, and there are no plans to create one — the per-migration history is the audit trail.

---

## Local development

The repo includes a `supabase/config.toml` for local-stack use (`supabase start`), but day-to-day development for this team runs against a Supabase branch (created via `mcp__<server>__create_branch`) rather than a local stack. Migrations applied to a branch via MCP write to that branch's migration ledger automatically. To merge a branch into main:

```text
mcp__<server>__merge_branch(branch_id)
```

This replays the branch's migrations onto the production project and updates the ledger.
