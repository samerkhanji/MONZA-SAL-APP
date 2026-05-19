-- ============================================================================
-- 131_sales_order_delivered_revert_block.sql
--
-- Harden the sales_orders status invariant:
--   Once status='delivered', it can ONLY move to 'cancelled' AND only via
--   the void path (UPDATE that also sets void_at IS NOT NULL) AND only by
--   an owner. Any other away-from-delivered transition is rejected.
--
-- Why: the previous trg_sales_orders_block_terminal_status_revert allowed
-- owners to revert delivered → anything. That bypassed the void audit trail
-- (no void_at/void_reason/void_by). Force the void RPC for the only legal exit.
--
-- The void RPC sets status='cancelled', void_at=now(), void_reason, void_by
-- in a single UPDATE — that path stays open. Plain status patches do not.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sales_orders_block_terminal_status_revert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  -- No status change → nothing to police.
  IF new.status IS NOT DISTINCT FROM old.status THEN
    RETURN new;
  END IF;

  -- Coming FROM delivered:
  --   ONLY allowed transition is to 'cancelled' through the void path,
  --   by an owner, with void_at being set in this same UPDATE.
  IF old.status = 'delivered'::sale_status THEN
    IF new.status = 'delivered'::sale_status THEN
      RETURN new; -- defensive; covered by IS DISTINCT above
    END IF;

    IF NOT public.is_owner() THEN
      RAISE EXCEPTION
        'sales_orders.status=delivered is terminal; only owner can void it (attempted: %)',
        new.status
        USING errcode = '40000';
    END IF;

    -- Owner is voiding: must be going to 'cancelled' AND must be setting
    -- void_at in the same UPDATE (the void_sales_order RPC does both).
    IF new.status = 'cancelled'::sale_status
       AND new.void_at IS NOT NULL
       AND old.void_at IS NULL THEN
      RETURN new;
    END IF;

    RAISE EXCEPTION
      'sales_orders.status=delivered can only exit via the void path (status=cancelled + void_at). Attempted: status=%, void_at=%',
      new.status, new.void_at
      USING errcode = '40000';
  END IF;

  -- Coming FROM cancelled: keep prior behavior — owner-only.
  IF old.status = 'cancelled'::sale_status THEN
    IF NOT public.is_owner() THEN
      RAISE EXCEPTION
        'sales_orders.status is terminal; only owner can change it (was: %, attempted: %)',
        old.status, new.status
        USING errcode = '40000';
    END IF;
  END IF;

  RETURN new;
END;
$fn$;

-- The trigger itself already exists (trg_sales_orders_block_terminal_status_revert)
-- and is wired up to this function — replacing the function is enough.
-- Recreate it defensively in case it was dropped.
DROP TRIGGER IF EXISTS trg_sales_orders_block_terminal_status_revert ON public.sales_orders;
CREATE TRIGGER trg_sales_orders_block_terminal_status_revert
  BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.sales_orders_block_terminal_status_revert();
