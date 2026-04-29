-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260424074939 as `rename_khalil_hybrid_to_hybrid`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- 1) Move the one user off the old value.
UPDATE public.profiles
   SET user_role = 'hybrid'::public.user_role
 WHERE user_role = 'khalil_hybrid'::public.user_role;

-- 2) Recreate every policy that names khalil_hybrid, substituting 'hybrid'.
DO $$
DECLARE
  r         RECORD;
  new_qual  text;
  new_check text;
  roles_txt text;
  cmd_clause text;
  perm_clause text;
  stmt      text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
      FROM pg_policies
     WHERE schemaname='public'
       AND (qual::text LIKE '%khalil_hybrid%' OR with_check::text LIKE '%khalil_hybrid%')
  LOOP
    new_qual   := replace(COALESCE(r.qual,       ''), 'khalil_hybrid', 'hybrid');
    new_check  := replace(COALESCE(r.with_check, ''), 'khalil_hybrid', 'hybrid');
    roles_txt  := array_to_string(r.roles, ', ');
    perm_clause := CASE WHEN r.permissive = 'PERMISSIVE' THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END;
    cmd_clause := CASE r.cmd
                    WHEN 'ALL'    THEN ' FOR ALL'
                    WHEN 'SELECT' THEN ' FOR SELECT'
                    WHEN 'INSERT' THEN ' FOR INSERT'
                    WHEN 'UPDATE' THEN ' FOR UPDATE'
                    WHEN 'DELETE' THEN ' FOR DELETE'
                    ELSE ' FOR ALL'
                  END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    stmt := format('CREATE POLICY %I ON %I.%I%s%s TO %s',
                   r.policyname, r.schemaname, r.tablename, perm_clause, cmd_clause, roles_txt);
    IF new_qual <> '' THEN
      stmt := stmt || ' USING (' || new_qual || ')';
    END IF;
    IF new_check <> '' THEN
      stmt := stmt || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE stmt;
  END LOOP;
END $$;

-- 3) Verify nothing still references khalil_hybrid in policies.
SELECT COUNT(*) AS policies_still_referencing_khalil_hybrid
  FROM pg_policies
 WHERE schemaname='public'
   AND (qual::text LIKE '%khalil_hybrid%' OR with_check::text LIKE '%khalil_hybrid%');
