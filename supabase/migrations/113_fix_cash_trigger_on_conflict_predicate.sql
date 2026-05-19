-- ============================================================================
-- HOTFIX C-9 follow-on: fix installment_payment_to_cash_movement ON CONFLICT.
--
-- The trigger used `ON CONFLICT (source_type, source_id) DO NOTHING` but the
-- matching unique index is partial: `WHERE source_type IS NOT NULL AND
-- source_id IS NOT NULL`. Postgres requires the ON CONFLICT clause to either
-- match a full unique index or to repeat the partial predicate. Without
-- it the query fails with 42P10. Net effect: every cash installment payment
-- had been failing in production. (Verified by stepping through
-- create_payment_plan with a cash down payment in a clean transaction.)
--
-- Fix: add the predicate to the ON CONFLICT clause.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.installment_payment_to_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_delta    numeric;
  v_drawer   uuid;
  v_session  uuid;
BEGIN
  IF NEW.payment_method IS DISTINCT FROM 'cash' THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.paid_amount, 0) - CASE
    WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.paid_amount, 0)
    ELSE 0
  END;

  IF v_delta IS NULL OR v_delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT s.id, s.drawer_id INTO v_session, v_drawer
    FROM public.cash_sessions s
    JOIN public.cash_drawers d ON d.id = s.drawer_id
   WHERE s.status = 'open' AND d.active = true
   ORDER BY d.created_at
   LIMIT 1;

  IF v_session IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cash_movements
    (session_id, kind, direction, amount, source_type, source_id, note, created_by)
  VALUES
    (v_session, 'installment_payment', 'in', v_delta,
     'installment_payment', NEW.id,
     'Installment #' || NEW.installment_no::text || ' (auto)',
     NEW.marked_paid_by)
  ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$fn$;
