-- Migration 149: maintain purchase_orders.estimated_total with a trigger.
--
-- The PO detail page recomputed estimated_total client-side with a
-- read-modify-write after each line add/delete. A stale in-memory line list
-- (or a concurrent edit on another tab/user) could write an out-of-date
-- total. Moving the recompute into an AFTER trigger on purchase_order_lines
-- makes the column always consistent with its lines, regardless of how the
-- lines were changed. The client write-back is removed in the same change.

CREATE OR REPLACE FUNCTION public.recalc_purchase_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.purchase_orders po
       SET estimated_total = COALESCE(
             (SELECT SUM(pol.line_total)
                FROM public.purchase_order_lines pol
               WHERE pol.po_id = OLD.po_id), 0)
     WHERE po.id = OLD.po_id;
    RETURN OLD;
  END IF;

  UPDATE public.purchase_orders po
     SET estimated_total = COALESCE(
           (SELECT SUM(pol.line_total)
              FROM public.purchase_order_lines pol
             WHERE pol.po_id = NEW.po_id), 0)
   WHERE po.id = NEW.po_id;

  -- A line reassigned to a different PO: refresh the old PO total too.
  IF (TG_OP = 'UPDATE' AND NEW.po_id IS DISTINCT FROM OLD.po_id) THEN
    UPDATE public.purchase_orders po
       SET estimated_total = COALESCE(
             (SELECT SUM(pol.line_total)
                FROM public.purchase_order_lines pol
               WHERE pol.po_id = OLD.po_id), 0)
     WHERE po.id = OLD.po_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions fire from the table trigger with the owner's rights and
-- never need an EXECUTE grant; revoking keeps it off the REST RPC surface
-- (mirrors migration 146).
REVOKE EXECUTE ON FUNCTION public.recalc_purchase_order_total()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_recalc_po_total ON public.purchase_order_lines;
CREATE TRIGGER trg_recalc_po_total
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.recalc_purchase_order_total();

-- One-time backfill: correct any rows that already drifted.
UPDATE public.purchase_orders po
   SET estimated_total = COALESCE(
         (SELECT SUM(pol.line_total)
            FROM public.purchase_order_lines pol
           WHERE pol.po_id = po.id), 0)
 WHERE po.estimated_total IS DISTINCT FROM COALESCE(
         (SELECT SUM(pol.line_total)
            FROM public.purchase_order_lines pol
           WHERE pol.po_id = po.id), 0);
