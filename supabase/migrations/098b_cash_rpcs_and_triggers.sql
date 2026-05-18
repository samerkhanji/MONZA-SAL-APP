-- RPCs for the cash flow + triggers that auto-attach cash payments.

CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_opening_balance numeric,
  p_drawer_id       uuid DEFAULT NULL,
  p_note            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_drawer, CURRENT_DATE, now(), v_caller, p_opening_balance, p_note, 'open'
  ) RETURNING id INTO v_session;

  IF p_opening_balance > 0 THEN
    INSERT INTO public.cash_movements
      (session_id, kind, direction, amount, note, created_by)
    VALUES
      (v_session, 'opening_float', 'in', p_opening_balance, 'Opening balance', v_caller);
  END IF;

  RETURN v_session;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.open_cash_session(numeric, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.open_cash_session(numeric, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id     uuid,
  p_actual_balance numeric,
  p_closing_note   text DEFAULT NULL,
  p_variance_note  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller     uuid := auth.uid();
  v_session    public.cash_sessions;
  v_sum_in     numeric;
  v_sum_out    numeric;
  v_expected   numeric;
  v_variance   numeric;
  v_threshold  numeric;
  v_new_status text;
  v_n          int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only cashier / owner can close a session' USING errcode = '42501';
  END IF;
  IF p_actual_balance IS NULL OR p_actual_balance < 0 THEN
    RAISE EXCEPTION 'Actual balance must be >= 0' USING errcode = '23514';
  END IF;

  SELECT * INTO v_session FROM public.cash_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session % not found', p_session_id USING errcode = '02000';
  END IF;
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Session is %, must be open', v_session.status USING errcode = '40000';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_sum_in
    FROM public.cash_movements
   WHERE session_id = p_session_id AND direction = 'in';
  SELECT COALESCE(sum(amount), 0) INTO v_sum_out
    FROM public.cash_movements
   WHERE session_id = p_session_id AND direction = 'out';

  v_expected := v_sum_in - v_sum_out;
  v_variance := p_actual_balance - v_expected;

  SELECT variance_threshold INTO v_threshold FROM public.cash_settings WHERE id = 'default';
  v_threshold := COALESCE(v_threshold, 20);

  IF abs(v_variance) > v_threshold
     AND (p_variance_note IS NULL OR length(trim(p_variance_note)) = 0) THEN
    RAISE EXCEPTION 'Variance % is over threshold % — a variance_note is required',
      v_variance, v_threshold USING errcode = '23514';
  END IF;

  v_new_status := CASE
    WHEN abs(v_variance) > v_threshold THEN 'flagged'
    ELSE 'closed'
  END;

  UPDATE public.cash_sessions
     SET status         = v_new_status,
         closed_at      = now(),
         closed_by      = v_caller,
         closing_actual = p_actual_balance,
         closing_note   = p_closing_note,
         variance       = v_variance,
         variance_note  = p_variance_note,
         updated_at     = now()
   WHERE id = p_session_id;

  IF v_new_status = 'flagged' THEN
    v_n := COALESCE(public.emit_notification(
      'cash.variance_over_threshold',
      'Cash variance ' || v_variance::text || ' on ' || v_session.business_date::text,
      'Expected ' || v_expected::text || ' · Counted ' || p_actual_balance::text
        || ' · Variance ' || v_variance::text
        || CASE WHEN p_variance_note IS NOT NULL
                THEN ' · Cashier note: ' || p_variance_note
                ELSE ''
           END,
      'cash_session',
      p_session_id,
      '/cash',
      jsonb_build_object(
        'session_id', p_session_id,
        'variance', v_variance,
        'expected', v_expected,
        'actual', p_actual_balance
      ),
      v_caller, NULL
    ), 0);
  END IF;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'status', v_new_status,
    'expected', v_expected,
    'actual', p_actual_balance,
    'variance', v_variance,
    'threshold', v_threshold,
    'cash_in', v_sum_in,
    'cash_out', v_sum_out
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_manual_cash_movement(
  p_kind       text,
  p_direction  text,
  p_amount     numeric,
  p_note       text DEFAULT NULL,
  p_drawer_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller   uuid := auth.uid();
  v_drawer   uuid;
  v_session  uuid;
  v_id       uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only cashier / owner can record manual cash movements'
      USING errcode = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0' USING errcode = '23514';
  END IF;
  IF p_direction NOT IN ('in','out') THEN
    RAISE EXCEPTION 'Direction must be in or out' USING errcode = '23514';
  END IF;
  IF p_kind NOT IN ('expense','manual_adjustment','refund','service_payment','parts_payment') THEN
    RAISE EXCEPTION 'Unsupported manual kind %', p_kind USING errcode = '23514';
  END IF;

  v_drawer := COALESCE(
    p_drawer_id,
    (SELECT id FROM public.cash_drawers WHERE active = true ORDER BY created_at LIMIT 1)
  );

  SELECT id INTO v_session FROM public.cash_sessions
    WHERE drawer_id = v_drawer AND status = 'open'
    LIMIT 1;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'No open cash session — open one first' USING errcode = '40000';
  END IF;

  INSERT INTO public.cash_movements
    (session_id, kind, direction, amount, note, created_by)
  VALUES
    (v_session, p_kind, p_direction, p_amount, p_note, v_caller)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_manual_cash_movement(text, text, numeric, text, uuid)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_manual_cash_movement(text, text, numeric, text, uuid)
  TO authenticated;

-- Auto-attach cash installment payments
CREATE OR REPLACE FUNCTION public.installment_payment_to_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  ON CONFLICT (source_type, source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_installment_payment_to_cash_movement
  ON public.installment_payments;
CREATE TRIGGER trg_installment_payment_to_cash_movement
  AFTER INSERT OR UPDATE OF paid_amount, payment_method
  ON public.installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.installment_payment_to_cash_movement();

-- Auto-attach cash sale deposits
CREATE OR REPLACE FUNCTION public.sales_order_deposit_to_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session  uuid;
BEGIN
  IF NEW.deposit_method IS DISTINCT FROM 'cash' THEN
    RETURN NEW;
  END IF;
  IF NEW.deposit_paid_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.deposit_paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.deposit_amount IS NULL OR NEW.deposit_amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_session
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
    (v_session, 'sale_deposit', 'in', NEW.deposit_amount,
     'sales_order_deposit', NEW.id,
     'Sale deposit for VIN ' || COALESCE(NEW.vin, '?') || ' (auto)',
     NEW.created_by)
  ON CONFLICT (source_type, source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sales_order_deposit_to_cash_movement
  ON public.sales_orders;
CREATE TRIGGER trg_sales_order_deposit_to_cash_movement
  AFTER INSERT OR UPDATE OF deposit_paid_at, deposit_method, deposit_amount
  ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_order_deposit_to_cash_movement();
