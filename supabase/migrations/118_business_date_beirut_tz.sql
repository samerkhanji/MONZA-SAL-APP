-- ============================================================================
-- 118_business_date_beirut_tz.sql
--
-- Use Beirut local date for cash session business_date instead of
-- server UTC CURRENT_DATE. Without this, sessions opened after the UTC
-- midnight roll-over but before Beirut midnight get tagged with the
-- following business day, breaking daily-close reports.
--
-- Touches:
--   - public.open_cash_session() — replaces CURRENT_DATE with
--     (now() AT TIME ZONE 'Asia/Beirut')::date in the INSERT.
--   - public.cash_sessions.business_date column default.
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

  INSERT INTO public.cash_sessions (
    drawer_id, business_date, opened_at, opened_by, opening_balance, opening_note, status
  ) VALUES (
    v_drawer,
    (now() AT TIME ZONE 'Asia/Beirut')::date,
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

ALTER TABLE public.cash_sessions
  ALTER COLUMN business_date SET DEFAULT (now() AT TIME ZONE 'Asia/Beirut')::date;
