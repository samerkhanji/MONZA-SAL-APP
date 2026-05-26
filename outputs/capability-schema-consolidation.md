# Capability schema drift investigation

PR #133 (DB audit) flagged that `public.profiles` carries two different
capability columns, `capabilities` (text[]) and `capabilities_jsonb`
(jsonb), and that they hold entirely different vocabularies on the same
row — with at least one owner row carrying an empty `capabilities_jsonb`.
This document captures what we found and why we picked Path A (drop the
jsonb column).

## What we have

### `profiles.capabilities` — `user_capability[]`, default `'{}'`

Backed by a Postgres `ENUM` named `user_capability` with **12 values**:

```
garage, vehicle_software, cashier, events_ops,
manage_team, edit_users, deactivate_users, view_reports,
inventory, sales, data_health, view_customer_documents
```

**Read sites in code (all read `capabilities`, never `capabilities_jsonb`):**

| File | Purpose |
| --- | --- |
| `web/src/lib/permissions.ts` (lines 306–415) | `getCapabilitiesFromProfile()`, `hasCapability()`, `hasAnyCapability()`, `hasAllCapabilities()` — the authoritative client-side capability gate. Hard-codes `AppCapability` type mirroring the 12 enum values. |
| `web/src/lib/contexts/UserContext.tsx` (line 259) | Single source for the React `UserContext`: `const capabilities = profile?.capabilities ?? []`. |
| `web/src/lib/user-lookup.ts` (line 75) | Server lookups: `.contains("capabilities", [capability])`. |
| `web/src/app/api/customers/[id]/export/route.ts` (line 38) | Export route authorization. |
| `web/src/components/settings/EditTeamMemberDialog.tsx` (line 123) | Reads back `profile.capabilities` to populate the edit form. |
| `web/src/app/(dashboard)/settings/page.tsx` (line 95) | Lists capabilities for each user in settings table. |

**Write sites in code:**

| File | Purpose |
| --- | --- |
| `web/src/app/api/team/add-employee/route.ts` (line 92) | Sanitises and writes `capabilities` on profile creation. |
| `web/src/components/settings/AddEmployeeDialog.tsx`, `EditTeamMemberDialog.tsx` | UI checkboxes call into the same writes. |

**DB-side write/maintenance:**

| Object | Effect |
| --- | --- |
| `profiles_owner_gets_all_capabilities()` trigger (migration `133`) | BEFORE INSERT/UPDATE OF `user_role, capabilities` — forces owners to hold the full enum. |
| `_require_any_capability()` RPC helper (migration `064`) | Server-side capability gate used by RPCs; reads `capabilities` only. |
| RLS policies in migrations `065`, `066`, `067`, `072`, `088`, `090`, `155`, etc. | All check `capabilities && ARRAY[...]::user_capability[]` or `'<cap>'::user_capability = ANY(capabilities)`. |

### `profiles.capabilities_jsonb` — `jsonb`, default `'{}'`

Holds a **different vocabulary** (boolean per key, 14 keys observed):

```
edit_sales, edit_users, view_sales, edit_garage,
manage_team, view_garage, manage_parts, edit_inventory,
view_inventory, manage_requests, deactivate_users,
edit_data_health, manage_customers, view_data_health
```

Only `manage_team`, `edit_users`, and `deactivate_users` overlap with the
text[] vocabulary by name. Everything else is unique to the jsonb shape
(view/edit split per module, `manage_parts`, `manage_customers`,
`manage_requests`).

**Read sites in code:** **none.**

```
$ grep -rn "capabilities_jsonb\|capabilitiesJsonb" web/ supabase/functions/
(no results)
```

The generated `web/src/types/database.ts` does not include the profiles
row type at all (only a manually curated subset), so the column is
invisible to TypeScript.

**Read sites in the DB:** only one — the
`profiles_block_self_privilege_escalation()` trigger lists
`capabilities_jsonb` among the fields that non-owners may not change.
That trigger is defensive only; nobody mutates the column in normal
operation, so the guard never fires for legitimate writes either.

No RLS policy, no RPC, no view in the live DB references
`capabilities_jsonb`. Two archived migrations (`_archive/025_…`,
`_archive/026_…`, `_archive/052_…`) and one currently-applied migration
(`057_fix_profiles_escalation_trigger_department_column.sql`) mention
it, but only the privilege-escalation guard above remains active.

## Source of truth (current de-facto)

**`capabilities` (text[]) is the source of truth, full stop.**

- Every client capability check goes through `permissions.ts` → reads
  `profile.capabilities`.
- Every server / RLS capability check reads `profiles.capabilities`.
- The owner-fill trigger only touches `capabilities`, never
  `capabilities_jsonb`.

`capabilities_jsonb` is dead infrastructure introduced in archived
migration `025_employee_management_schema.sql` as an "intended
successor" to the text[] format. The codebase never adopted it — the
text[] enum approach was kept and extended (see migration `133` and the
12-value enum). The jsonb column has been silently drifting ever since:
- A backfill in migration `025` populated 7 rows with role-derived
  defaults.
- Row `sam@monzasal.com` (owner) was inserted **after** migration `025`
  ran, so its `capabilities_jsonb` is still `'{}'`.
- Nothing in the current write path keeps either column in sync; nothing
  in the read path uses the jsonb column. The "drift" reported by the
  audit is the inevitable consequence of leaving a populated column
  attached to a table that no longer references it.

## Per-user state (live, 2026-05-26)

| email | role | text[] caps | jsonb keys (true) | jsonb keys (false) | jsonb keys (total) |
| --- | --- | --- | --- | --- | --- |
| kareem@monzasal.com | owner | 12 | 14 | 0 | 14 |
| sam@monzasal.com | owner | 12 | 0 | 0 | **0 (empty!)** |
| skhanji55@gmail.com | owner | 12 | 14 | 0 | 14 |
| mark@monzasal.com | garage_manager | 4 | 4 | 10 | 14 |
| lara@monzasal.com | assistant | 5 | 3 | 11 | 14 |
| samaya@monzasal.com | assistant | 5 | 3 | 11 | 14 |
| suhail@monzasal.com | garage_staff | 2 | 1 | 13 | 14 |
| khalil@monzasal.com | hybrid | 7 | 1 | 13 | 14 |

Total rows: 8. Rows with `capabilities_jsonb = '{}'`: **1**. Rows with
non-empty `capabilities`: **8**.

The divergence is not just per-row: the two columns model **different
permission concepts** (coarse module gates vs. view/edit-per-module
booleans) and no code reconciles them.

## Recommendation: Path A — drop `capabilities_jsonb`

Path A as proposed in the task brief. Justification:

1. **Zero code reads from `capabilities_jsonb`** (TypeScript, server,
   SQL, RLS, RPCs).
2. **Zero code writes to `capabilities_jsonb`** outside of the archived
   one-time backfill in migration `025`.
3. **The text[] form is heavily entrenched**: a Postgres ENUM,
   the canonical `_require_any_capability()` helper, the
   `profiles_owner_gets_all_capabilities` auto-fill trigger, and dozens
   of RLS predicates. Migrating to jsonb would be a substantial rewrite
   with no upside.
4. **The jsonb column is actively dangerous** — its presence creates the
   exact "two-vocabulary auth surface" the audit flagged. Removing it
   eliminates the divergence vector and the cost of remembering it
   exists.

Path B (backfill jsonb and sync) was rejected because there is no
consumer to backfill *for*. Path C (keep both) was rejected because the
investigation found no live code path that needs the jsonb shape.

## Migration plan

### DB (one migration: `156_drop_profiles_capabilities_jsonb.sql`)

1. Drop `capabilities_jsonb` from
   `profiles_block_self_privilege_escalation()` (recreate the function
   without that branch).
2. `ALTER TABLE public.profiles DROP COLUMN capabilities_jsonb;`

The privilege-escalation guard remains intact for every other
privileged field (`user_role`, `is_active`, `employment_status`,
`capabilities`, `created_by`, `can_view_owner_requests`,
`is_pipeline_user`, `department`). The column drop is safe because
no policy, RPC, view, trigger, index, constraint, or app code touches
the column.

### Code

No code changes are required to drop the column (nothing reads it).
We do *not* edit the archived migrations under
`supabase/migrations/_archive/`; they remain as historical artefacts.

### Rollback

If we ever discover a hidden consumer, the column can be re-added with
`ALTER TABLE public.profiles ADD COLUMN capabilities_jsonb jsonb NOT
NULL DEFAULT '{}'::jsonb;`. The contents we are dropping are
deterministic boolean masks derivable from `user_role` + `capabilities`
(see migration `025` lines 22–40 for the original derivation rule), so
no irreplaceable data is being destroyed.
