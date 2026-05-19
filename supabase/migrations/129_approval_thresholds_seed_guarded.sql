-- 129_approval_thresholds_seed_guarded.sql
-- Sanity migration:
--   * Ensure the 4 standard threshold rows exist (refund, estimate, parts_order, goodwill)
--   * Never overwrite values already tuned by owner/manager (ON CONFLICT DO NOTHING).
--   * Ensure a CHECK constraint enforces owner_floor >= manager_floor.
--     The original migration (096) added approval_thresholds_floors_ordered with the
--     same predicate; we add approval_thresholds_owner_floor_ge_manager_floor only
--     if the spec'd name does not already exist (idempotent).

INSERT INTO public.approval_thresholds
  (id, label_en, description, currency, manager_floor, owner_floor)
VALUES
  ('refund',
     'Parts or service refund',
     'Refund amount above manager_floor needs manager; above owner_floor needs owner.',
     'USD', 50, 500),
  ('estimate',
     'Repair estimate',
     'Estimates >= manager_floor need manager sign-off; >= owner_floor need owner.',
     'USD', 300, 2000),
  ('parts_order',
     'Parts order (supplier)',
     'Single parts order amount. Manager places below owner_floor; owner above.',
     'USD', 0, 1000),
  ('goodwill',
     'Goodwill discount',
     'Goodwill given to a customer. Manager up to owner_floor; owner above.',
     'USD', 0, 300)
ON CONFLICT (id) DO NOTHING;

-- Backfill: any rows accidentally created with NULL manager_floor / currency
-- (shouldn't happen, but be defensive) get a sane default.
UPDATE public.approval_thresholds
   SET manager_floor = 0
 WHERE manager_floor IS NULL;
UPDATE public.approval_thresholds
   SET currency = 'USD'
 WHERE currency IS NULL OR currency = '';

-- Owner-floor must be at least the manager floor. The original 096 migration
-- already added a CHECK with predicate `(owner_floor >= manager_floor)` under
-- the name `approval_thresholds_floors_ordered`. Add the spec'd-named CHECK
-- only if it isn't already present (no-op if 096 is in place).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'approval_thresholds_owner_floor_ge_manager_floor'
       AND conrelid = 'public.approval_thresholds'::regclass
  )
  AND NOT EXISTS (
    -- Skip if an equivalent constraint already enforces the same predicate.
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.approval_thresholds'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%owner_floor%>=%manager_floor%'
  )
  THEN
    EXECUTE 'ALTER TABLE public.approval_thresholds
             ADD CONSTRAINT approval_thresholds_owner_floor_ge_manager_floor
             CHECK (owner_floor >= manager_floor)';
  END IF;
END
$$;
