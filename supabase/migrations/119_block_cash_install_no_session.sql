-- ============================================================================
-- 119_block_cash_install_no_session.sql
--
-- Today apply_installment_payment() succeeds even if there is no open cash
-- session; the trigger silently drops the movement (see migration 113 fn).
-- Result: ledger drift between installments and cash. Better to fail fast.
--
-- This migration replaces public.apply_installment_payment with the same
-- body PLUS an early guard that raises 40000 when p_payment_method='cash'
-- and no open session exists. The existing
-- installment_payment_to_cash_movement trigger is left in place — it's now
-- redundant for the cash-no-session case but still useful as a safety net.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_installment_payment(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_receipt_url text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_caller       uuid := auth.uid();
  v_inst         public.installment_payments;
  v_plan         public.payment_plans;
  v_new_paid     numeric;
  v_overage      numeric := 0;
  v_new_status   public.installment_status;
  v_all_paid     boolean;
  v_owner_ids    uuid[];
  v_has_session  boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF NOT (public.is_owner() OR public.has_capability('cashier'::user_capability)) THEN
    RAISE EXCEPTION 'Only owners or cashiers can record installment payments'
      USING errcode = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0' USING errcode = '23514';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'Payment method is required' USING errcode = '23514';
  END IF;

  -- Guard: cash requires an open session.
  IF p_payment_method = 'cash' THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.cash_sessions s
        JOIN public.cash_drawers d ON d.id = s.drawer_id
       WHERE s.status = 'open' AND d.active = true
    ) INTO v_has_session;

    IF NOT v_has_session THEN
      RAISE EXCEPTION 'No open cash session — open a session before recording a cash payment.'
        USING errcode = '40000';
    END IF;
  END IF;

  SELECT * INTO v_inst
    FROM public.installment_payments
   WHERE id = p_installment_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'installment % not found', p_installment_id USING errcode = '02000';
  END IF;
  IF v_inst.status = 'paid' THEN
    RAISE EXCEPTION 'Installment is already fully paid' USING errcode = '40000';
  END IF;
  IF v_inst.status = 'waived' THEN
    RAISE EXCEPTION 'Installment was waived; recording a payment is not allowed'
      USING errcode = '40000';
  END IF;

  SELECT * INTO v_plan FROM public.payment_plans WHERE id = v_inst.plan_id;

  v_new_paid := COALESCE(v_inst.paid_amount, 0) + p_amount;

  IF v_new_paid >= v_inst.amount_due THEN
    v_overage := v_new_paid - v_inst.amount_due;
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.installment_payments
     SET status         = v_new_status,
         paid_amount    = LEAST(v_new_paid, v_inst.amount_due),
         paid_at        = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
         payment_method = COALESCE(p_payment_method, payment_method),
         receipt_url    = COALESCE(p_receipt_url, receipt_url),
         note           = COALESCE(p_note, note),
         marked_paid_by = v_caller,
         updated_at     = now()
   WHERE id = p_installment_id;

  -- Overage → customer_credits ledger
  IF v_overage > 0 AND v_plan.customer_id IS NOT NULL THEN
    INSERT INTO public.customer_credits (
      customer_id, amount, currency, source_type, source_id, note, created_by
    ) VALUES (
      v_plan.customer_id,
      v_overage,
      'USD',
      'installment_overpayment',
      p_installment_id,
      'Overpayment on installment #' || v_inst.installment_no::text ||
        ' of plan ' || v_plan.id::text,
      v_caller
    );

    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES (
      'installment.overpayment',
      'info',
      'Overpayment of ' || v_overage::text || ' on installment ' || p_installment_id::text,
      jsonb_build_object(
        'installment_id', p_installment_id,
        'plan_id', v_inst.plan_id,
        'customer_id', v_plan.customer_id,
        'overage', v_overage,
        'actor', v_caller
      )
    );
  END IF;

  -- Underpayment → audit + owner notification
  IF v_new_status = 'partial' THEN
    INSERT INTO public.system_events (event_type, severity, message, metadata)
    VALUES (
      'installment.underpayment',
      'warning',
      'Partial payment on installment ' || p_installment_id::text ||
        ': paid ' || v_new_paid::text || ' of ' || v_inst.amount_due::text,
      jsonb_build_object(
        'installment_id', p_installment_id,
        'plan_id', v_inst.plan_id,
        'customer_id', v_plan.customer_id,
        'paid_total', v_new_paid,
        'amount_due', v_inst.amount_due,
        'shortfall', v_inst.amount_due - v_new_paid,
        'actor', v_caller
      )
    );

    SELECT array_agg(id) INTO v_owner_ids
      FROM public.profiles
     WHERE user_role = 'owner' AND is_active = true;

    IF v_owner_ids IS NOT NULL AND array_length(v_owner_ids, 1) > 0 THEN
      INSERT INTO public.notifications (user_id, title, message, link, is_read)
      SELECT
        r,
        'Partial installment payment',
        'Installment #' || v_inst.installment_no::text ||
          ' was short-paid by ' || (v_inst.amount_due - v_new_paid)::text ||
          '. Review on the plan.',
        '/installments',
        false
      FROM unnest(v_owner_ids) AS r;
    END IF;
  END IF;

  -- If this completes the plan, mark plan completed + notify owners/assistants
  IF v_new_status = 'paid' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.installment_payments
       WHERE plan_id = v_inst.plan_id
         AND status NOT IN ('paid', 'waived')
    ) INTO v_all_paid;

    IF v_all_paid THEN
      UPDATE public.payment_plans
         SET status = 'completed', updated_at = now()
       WHERE id = v_inst.plan_id;

      SELECT array_agg(id) INTO v_owner_ids
        FROM public.profiles
       WHERE user_role IN ('owner', 'assistant') AND is_active = true;

      IF v_owner_ids IS NOT NULL AND array_length(v_owner_ids, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, is_read)
        SELECT
          r,
          'Payment plan completed',
          'Plan ' || v_inst.plan_id::text || ' is fully paid.',
          '/installments',
          false
        FROM unnest(v_owner_ids) AS r;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'installment_id', p_installment_id,
    'new_status', v_new_status::text,
    'new_paid_amount', LEAST(v_new_paid, v_inst.amount_due),
    'overage_to_credits', v_overage,
    'shortfall', GREATEST(v_inst.amount_due - v_new_paid, 0)
  );
END;
$fn$;
