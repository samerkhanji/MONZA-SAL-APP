-- Repair: ensure garage_bays.sort_order exists (older DBs may predate 037).
ALTER TABLE public.garage_bays
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.garage_bays.sort_order IS 'Display order in bay pickers and lists.';
