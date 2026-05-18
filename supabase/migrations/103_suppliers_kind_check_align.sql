-- ============================================================================
-- HOTFIX C-3: align suppliers.kind CHECK with the Supplier Management UI
-- shipped in PR #57. The CHECK accepted ('parts','vehicles','services','other')
-- but the UI offers ('parts','vehicle','accessory','service','supplies','other')
-- — 4 of 6 dropdown options failed to insert.
--
-- public.suppliers is currently empty (verified before migration), so this
-- is a no-data-impact constraint swap. The defensive UPDATE statements
-- below ensure that if any plural-form rows ever exist (e.g. from a future
-- import that picked up the old enum) they are migrated to singular before
-- the new CHECK is applied.
-- ============================================================================

UPDATE public.suppliers SET kind = 'vehicle' WHERE kind = 'vehicles';
UPDATE public.suppliers SET kind = 'service' WHERE kind = 'services';

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_kind_check;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_kind_check
  CHECK (kind IN ('parts','vehicle','accessory','service','supplies','other'));
