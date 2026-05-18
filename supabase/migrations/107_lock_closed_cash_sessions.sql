-- ============================================================================
-- HOTFIX C-8: lock closed cash sessions.
--
-- Pre-hotfix: cash_movements_owner_write allowed owner ALL operations with
-- no guard on parent session status. Once a session was closed/flagged the
-- owner could still INSERT, UPDATE, or DELETE movements — silently changing
-- historical totals and variance. The cash_sessions row itself was also
-- freely mutable post-close, so the close could even be reversed.
--
-- This migration adds two BEFORE triggers:
--   1. cash_movements_lock_closed_session: blocks INSERT/UPDATE/DELETE on a
--      cash_movements row whose parent cash_sessions.status <> 'open'.
--   2. cash_sessions_lock_close_fields: once a session has transitioned off
--      'open', blocks subsequent UPDATEs that touch any reconciliation field
--      (status, closed_at, closed_by, closing_actual, closing_note,
--      variance, variance_note, opening_balance, opening_note, business_date).
--
-- If a future correction is needed, the owner must add an explicit
-- reopen_cash_session RPC (out of scope for this hotfix).
--
-- Verified with end-to-end smoke test against prod:
--   open  -> insert movement       PASS
--   open  -> closed transition     PASS
--   closed -> insert movement      REJECTED (40000)
--   closed -> update movement      REJECTED (40000)
--   closed -> delete movement      REJECTED (40000)
--   closed -> reopen session       REJECTED (40000)
--   closed -> edit variance        REJECTED (40000)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cash_movements_lock_closed_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_session_id uuid;
  v_status     text;
BEGIN
  v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  IF v_session_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_status
  FROM public.cash_sessions
  WHERE id = v_session_id;

  IF v_status IS NOT NULL AND v_status <> 'open' THEN
    RAISE EXCEPTION
      'Cash session % is %, movements are locked. Reopen via an owner action first.',
      v_session_id, v_status
      USING errcode = '40000';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS cash_movements_lock_closed_session ON public.cash_movements;
CREATE TRIGGER cash_movements_lock_closed_session
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.cash_movements_lock_closed_session();

-- ----------------------------------------------------------------------------
-- Lock the reconciliation fields on cash_sessions once status leaves 'open'.
-- Allowed transitions are:
--   open -> closed       (via close_cash_session RPC)
--   open -> flagged      (via close_cash_session RPC, variance over threshold)
-- Any later modification of these fields on a non-open session is blocked.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cash_sessions_lock_close_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF OLD.status = 'open' THEN
    RETURN NEW;
  END IF;
  IF NEW.status          IS DISTINCT FROM OLD.status          THEN RAISE EXCEPTION 'cash_sessions.status is locked on a non-open session' USING errcode='40000'; END IF;
  IF NEW.closed_at       IS DISTINCT FROM OLD.closed_at       THEN RAISE EXCEPTION 'cash_sessions.closed_at is locked'       USING errcode='40000'; END IF;
  IF NEW.closed_by       IS DISTINCT FROM OLD.closed_by       THEN RAISE EXCEPTION 'cash_sessions.closed_by is locked'       USING errcode='40000'; END IF;
  IF NEW.closing_actual  IS DISTINCT FROM OLD.closing_actual  THEN RAISE EXCEPTION 'cash_sessions.closing_actual is locked'  USING errcode='40000'; END IF;
  IF NEW.closing_note    IS DISTINCT FROM OLD.closing_note    THEN RAISE EXCEPTION 'cash_sessions.closing_note is locked'    USING errcode='40000'; END IF;
  IF NEW.variance        IS DISTINCT FROM OLD.variance        THEN RAISE EXCEPTION 'cash_sessions.variance is locked'        USING errcode='40000'; END IF;
  IF NEW.variance_note   IS DISTINCT FROM OLD.variance_note   THEN RAISE EXCEPTION 'cash_sessions.variance_note is locked'   USING errcode='40000'; END IF;
  IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN RAISE EXCEPTION 'cash_sessions.opening_balance is locked' USING errcode='40000'; END IF;
  IF NEW.opening_note    IS DISTINCT FROM OLD.opening_note    THEN RAISE EXCEPTION 'cash_sessions.opening_note is locked'    USING errcode='40000'; END IF;
  IF NEW.business_date   IS DISTINCT FROM OLD.business_date   THEN RAISE EXCEPTION 'cash_sessions.business_date is locked'   USING errcode='40000'; END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS cash_sessions_lock_close_fields ON public.cash_sessions;
CREATE TRIGGER cash_sessions_lock_close_fields
  BEFORE UPDATE
  ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.cash_sessions_lock_close_fields();
