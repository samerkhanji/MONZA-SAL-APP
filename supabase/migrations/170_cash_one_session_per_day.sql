-- ============================================================================
-- 170_cash_one_session_per_day.sql
--
-- Bug: the page states "One session per day", but open_cash_session() only
-- rejected opening when another session was currently OPEN for the drawer. A
-- cashier could open a session, close it, and immediately open a second
-- session on the same business date — corrupting daily reconciliation.
--
-- Fix: also reject when a session already exists for the drawer on today's
-- (Beirut) business date, regardless of its status. Re-creates the function
-- from migration 118 verbatim, adding only the same-day guard.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_opening_balance numeric,
  p_drawer_id uuid DEFAULT NULL::uuid,
  p_note text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_drawer   uuid;
  v_session  uuid;
  v_today    date := (now() AT TIME ZONE 'Asia/Beirut')::date;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only cashier / owner can open a cash session' USING errcode = '42501';
  END IF;
  IF p_opening_balance IS NULL OR p_opening_balance < 0 THEN
    RAISE EXCEPTION 'Opening balance must be >= 0' USING errcode = '23514';
  END IF;

  -- Pick the drawer: explicit, or the only active drawer.
  v_drawer := COALESCE(
    p_drawer_id,
    (SELECT id FROM public.cash_drawers WHERE active = true ORDER BY created_at LIMIT 1)
  );
  IF v_drawer IS NULL THEN
    RAISE EXCEPTION 'No active cash drawer found' USING errcode = '02000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
     WHERE drawer_id = v_drawer AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'A session is already open for this drawer — close it first'
      USING errcode = '40000';
  END IF;

  -- One session per day: a session (now closed/flagged/etc.) already exists for
  -- this drawer today, so a second one must not be created.
  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
     WHERE drawer_id = v_drawer AND business_date = v_today
  ) THEN
    RAISE EXCEPTION 'A session has already been opened for this drawer today — only one session per day is allowed'
      USING errcode = '40000';
  END IF;

  INSERT INTO public.cash_sessions (
    drawer_id, business_date, opened_at, opened_by, opening_balance, opening_note, status
  ) VALUES (
    v_drawer,
    v_today,
    now(),
    v_caller,
    p_opening_balance,
    p_note,
    'open'
  ) RETURNING id INTO v_session;

  -- Record the opening float as a movement for full audit.
  IF p_opening_balance > 0 THEN
    INSERT INTO public.cash_movements
      (session_id, kind, direction, amount, note, created_by)
    VALUES
      (v_session, 'opening_float', 'in', p_opening_balance,
       'Opening balance', v_caller);
  END IF;

  RETURN v_session;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.open_cash_session(numeric, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.open_cash_session(numeric, uuid, text) TO authenticated;
