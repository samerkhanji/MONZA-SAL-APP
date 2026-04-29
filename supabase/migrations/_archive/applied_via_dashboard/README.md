# Dashboard-applied migrations (backfilled)


These migrations were applied to production via the Supabase Dashboard SQL
editor between 2026-04-09 and 2026-04-25 but never committed to the repo.
On 2026-04-29 they were pulled from `supabase_migrations.schema_migrations`
and saved here for audit trail + reproducibility.

The canonical numbered sequence (001-061) in the parent directory remains
the project's primary migration history. These files exist so a fresh
`supabase db reset` from this repo produces the same schema as production.

## Sort order
Filenames use prod timestamps (`YYYYMMDDhhmmss_name.sql`) so they sort
chronologically by `ls`.

## Files

- `20260409095527_052_accessory_car_id_refactor.sql` - Replaces `linked_plate` with a `car_id` FK on accessory tables and adds display views.
- `20260409103020_055_drop_car_events_meta.sql` - Drops the legacy `meta` column from `car_events`.
- `20260420132715_security_hardening_live_20260420.sql` - Hardens RLS, function search_path, and grants for production security posture.
- `20260420135100_create_missing_tables_20260420.sql` - Creates tables that the application code references but were missing in prod.
- `20260420135119_rename_tables_to_match_code_20260420.sql` - Renames legacy tables so they match the names the application expects.
- `20260420135243_cleanup_dead_tables_columns_v3_20260420.sql` - Drops dead tables and columns that no application code references.
- `20260420140428_final_cleanup_v3_20260420.sql` - Final round of dead-object cleanup after the rename and column-drop passes.
- `20260420141019_drop_profiles_role_v2_20260420.sql` - Drops the legacy `profiles.role` column in favour of the user_roles table.
- `20260423130124_final_orphan_cleanup_20260420.sql` - Removes the last orphaned rows and constraints surfaced by the cleanup passes.
- `20260423133017_rule_consolidation_v2_20260420.sql` - Consolidates and deduplicates RLS policies across the schema.
- `20260424074939_rename_khalil_hybrid_to_hybrid.sql` - Renames the Khalil-specific hybrid identifiers to the generic `hybrid` value.
- `20260424075722_garage_jobs_align_columns_to_code.sql` - Aligns garage_jobs columns with the names the application code expects.
- `20260424081103_ui_drift_fixes_20260424.sql` - Backfills schema changes that had drifted from the UI implementation.
- `20260424082234_drop_premature_mfa_restrictive_policies.sql` - Drops MFA-gated RLS policies that were enabled before the UI was ready.
- `20260424090837_fix_role_helpers_after_role_column_drop.sql` - Repairs role-helper functions that broke when profiles.role was dropped.
- `20260424091616_cars_add_warranty_expiry_compat_cols.sql` - Adds compatibility columns on cars for the warranty expiry feature.
- `20260425083838_garage_workflow_buildout.sql` - Builds out the full garage workflow tables, RPCs, and policies.
- `20260425084756_add_attach_job_to_bay_rpc.sql` - Adds the `attach_job_to_bay` RPC used by the garage scheduler UI.
- `20260425100652_056b_complete_delivery_fix.sql` - Fixes the `complete_delivery` RPC to use the real `sale_status` enum value `delivered`.
