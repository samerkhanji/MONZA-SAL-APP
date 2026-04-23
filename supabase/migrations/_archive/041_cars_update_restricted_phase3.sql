-- ============================================
-- MONZA CRM — Phase 3: patch the existing single cars UPDATE RLS policy
--
-- Prerequisite: policy cars_update_restricted already exists on public.cars
-- (cars_select_access, cars_delete_owner unchanged).
--
-- Uses ALTER POLICY only — no DROP/CREATE, no second UPDATE policy, no new
-- policy name. Phase 3 field-level rules remain in migration 040 triggers.
--
-- Extends USING/WITH CHECK so assistant + khalil_hybrid may issue UPDATEs;
-- sensitive columns are still gated by cars_phase3_enforce_warranty_pdi_changes.
--
-- If your pre-Phase-3 policy had extra predicates (e.g. deleted_at IS NULL),
-- merge them with AND into the expressions below (this migration overwrites
-- USING/WITH CHECK entirely).
-- ============================================

ALTER POLICY cars_update_restricted ON public.cars
  USING (
    public.is_any_role_resolved(ARRAY[
      'owner',
      'garage_manager',
      'sales_ops',
      'assistant',
      'khalil_hybrid'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.is_any_role_resolved(ARRAY[
      'owner',
      'garage_manager',
      'sales_ops',
      'assistant',
      'khalil_hybrid'
    ]::public.user_role[])
  );

COMMENT ON POLICY cars_update_restricted ON public.cars IS
  'Single table-level UPDATE gate. Phase 3: assistant + khalil_hybrid added; Monza/DMS/PDI columns enforced by cars_phase3_enforce_warranty_pdi_changes.';
