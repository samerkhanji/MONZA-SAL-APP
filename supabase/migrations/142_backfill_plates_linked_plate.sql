-- Migration 142: backfill accessory_inventory.linked_plate for plates rows.
--
-- For rows in the "plates" category the UI keeps linked_plate equal to the
-- trimmed label (the linked_plate input is disabled and only re-synced when
-- the label is edited). Legacy / imported plates rows whose linked_plate was
-- never in sync therefore never self-correct. This one-time backfill aligns
-- them; ongoing edits keep them in sync via the existing UI logic.

UPDATE public.accessory_inventory
SET linked_plate = NULLIF(TRIM(label), '')
WHERE category = 'plates'
  AND linked_plate IS DISTINCT FROM NULLIF(TRIM(label), '');
