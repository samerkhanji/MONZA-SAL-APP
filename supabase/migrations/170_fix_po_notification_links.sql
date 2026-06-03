-- ============================================
-- Monza S.A.L. — fix purchase-order notification deep links
-- Migration 170 (launch QA, 2026-06-03)
--
-- Five PO notification RPCs emit a link to `/parts/purchase-orders/<id>`, which
-- 404s — the real route is `/garage/purchase-orders/<id>`. Affected functions:
--   approve_purchase_order, reject_purchase_order, submit_purchase_order
--   (2 links), attach_purchase_order_invoice, record_purchase_order_receipt.
--
-- Rather than re-state each (large) function body — and risk regressing logic —
-- we rewrite each in place: pull its current definition, swap ONLY the bad
-- path literal, and re-run it. CREATE OR REPLACE preserves ownership and the
-- EXECUTE grants applied to the money-mover RPCs in migrations 157/168.
--
-- Then backfill the 27 existing notification rows that already carry the wrong
-- link so past notifications resolve correctly too.
--
-- Idempotent: once no function/row contains `/parts/purchase-orders/`, both
-- steps are no-ops.
-- ============================================

DO $$
DECLARE
  r   record;
  def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosrc LIKE '%/parts/purchase-orders/%'
  LOOP
    def := pg_get_functiondef(r.oid);
    def := replace(def, '/parts/purchase-orders/', '/garage/purchase-orders/');
    EXECUTE def;
  END LOOP;
END $$;

-- Backfill already-emitted notifications.
UPDATE public.notifications
SET link = replace(link, '/parts/purchase-orders/', '/garage/purchase-orders/')
WHERE link LIKE '/parts/purchase-orders/%';
