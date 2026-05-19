-- ============================================================================
-- HOTFIX C-9: create_payment_plan RPC.
--
-- Pre-hotfix: installments/page.tsx INSERTed a synthetic
--   { installment_no: 0, status: 'paid', payment_method: 'Down Payment',
--     paid_amount: down }
-- row directly into installment_payments. That path bypassed:
--   - apply_installment_payment() (the canonical write path)
--   - the cash trigger that auto-attaches a cash_movements row when
--     payment_method is 'cash' and a session is open
--   - the customer_credits ledger (for overpayments)
--   - the audit/notification trail for partial vs. full
--
-- The fix is a single SECURITY DEFINER RPC that does everything in one
-- transaction:
--   1) INSERT payment_plans
--   2) INSERT a down-payment installment_no=0 row with status='upcoming'
--      (NOT 'paid' -- let apply_installment_payment transition it)
--   3) INSERT the monthly installment_no 1..months rows with their
--      pre-computed due_dates from the UI
--   4) CALL apply_installment_payment on the down-payment installment so
--      the cash trigger / credits ledger / audit all fire correctly.
--
-- The UI keeps owning the day-clamp logic via installmentDueDateIso() and
-- passes a date[] (length p_months) so we don't re-implement clamping in SQL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_payment_plan(
  p_customer_id          uuid,
  p_car_id               uuid,
  p_total_amount         numeric,
  p_down_payment         numeric,
  p_monthly_amount       numeric,
  p_months               integer,
  p_start_date           date,
  p_due_day              integer,
  p_due_dates            date[],
  p_interest_rate        numeric DEFAULT 0,
  p_down_payment_method  text    DEFAULT NULL,
  p_down_payment_note    text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_plan_id  uuid;
  v_down_id  uuid;
  i          integer;
  v_due_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (
       public.is_owner()
    OR public.has_capability('cashier'::user_capability)
    OR public.has_capability('sales'::user_capability)
  ) THEN
    RAISE EXCEPTION 'Insufficient permission to create payment plans'
      USING errcode = '42501';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required' USING errcode = '23502';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be > 0' USING errcode = '23514';
  END IF;
  IF p_down_payment IS NULL OR p_down_payment < 0 THEN
    RAISE EXCEPTION 'Down payment must be >= 0' USING errcode = '23514';
  END IF;
  IF p_monthly_amount IS NULL OR p_monthly_amount <= 0 THEN
    RAISE EXCEPTION 'Monthly amount must be > 0' USING errcode = '23514';
  END IF;
  IF p_months IS NULL OR p_months <= 0 THEN
    RAISE EXCEPTION 'Months must be > 0' USING errcode = '23514';
  END IF;
  IF p_due_day IS NULL OR p_due_day < 1 OR p_due_day > 31 THEN
    RAISE EXCEPTION 'Due day must be between 1 and 31' USING errcode = '23514';
  END IF;
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'Start date is required' USING errcode = '23502';
  END IF;

  v_due_count := COALESCE(array_length(p_due_dates, 1), 0);
  IF v_due_count <> p_months THEN
    RAISE EXCEPTION 'due_dates length (%) must equal months (%)',
      v_due_count, p_months USING errcode = '23514';
  END IF;

  IF p_down_payment > 0
     AND (p_down_payment_method IS NULL OR length(trim(p_down_payment_method)) = 0) THEN
    RAISE EXCEPTION 'Payment method is required when down_payment > 0'
      USING errcode = '23514';
  END IF;

  INSERT INTO public.payment_plans (
    customer_id, car_id, status, total_amount, down_payment,
    monthly_amount, months, start_date, due_day, interest_rate, created_by
  ) VALUES (
    p_customer_id, p_car_id, 'active', p_total_amount, p_down_payment,
    p_monthly_amount, p_months, p_start_date, p_due_day,
    COALESCE(p_interest_rate, 0), v_caller
  )
  RETURNING id INTO v_plan_id;

  IF p_down_payment > 0 THEN
    INSERT INTO public.installment_payments (
      plan_id, installment_no, due_date, amount_due, status
    ) VALUES (
      v_plan_id, 0, p_start_date, p_down_payment, 'upcoming'
    )
    RETURNING id INTO v_down_id;
  END IF;

  FOR i IN 1..p_months LOOP
    INSERT INTO public.installment_payments (
      plan_id, installment_no, due_date, amount_due, status
    ) VALUES (
      v_plan_id, i, p_due_dates[i], p_monthly_amount, 'upcoming'
    );
  END LOOP;

  IF v_down_id IS NOT NULL THEN
    PERFORM public.apply_installment_payment(
      v_down_id,
      p_down_payment,
      p_down_payment_method,
      NULL,
      COALESCE(p_down_payment_note, 'Down payment on plan ' || v_plan_id::text)
    );
  END IF;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'down_payment_installment_id', v_down_id
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.create_payment_plan(uuid, uuid, numeric, numeric, numeric, integer, date, integer, date[], numeric, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_payment_plan(uuid, uuid, numeric, numeric, numeric, integer, date, integer, date[], numeric, text, text) TO authenticated;
