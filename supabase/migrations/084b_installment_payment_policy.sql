-- Wave 12 (b): installment over/underpayment policy.
--
-- Overpayments: any amount above amount_due is written to a per-customer
-- credits ledger (public.customer_credits). The installment is marked 'paid'.
--
-- Underpayments: installment is left at 'partial' status with paid_amount =
-- amount paid so far. Owner is notified. A second payment can complete it
-- (cumulative paid_amount; flips to 'paid' once paid_amount >= amount_due,
-- with any additional overage going to credits).
--
-- Prerequisite: 084a adds the 'partial' value to installment_status.

-- ============================================================================
-- customer_credits ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_credits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount      numeric NOT NULL CHECK (amount <> 0),
  currency    text NOT NULL DEFAULT 'USD',
  source_type text NOT NULL CHECK (source_type IN (
    'installment_overpayment',
    'manual_credit',
    'refund',
    'applied_to_installment'
  )),
  source_id   uuid,
  note        text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer
  ON public.customer_credits(customer_id);

ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_credits_sel ON public.customer_credits;
CREATE POLICY customer_credits_sel ON public.customer_credits
  FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR public.has_capability('cashier'::user_capability)
    OR public.has_capability('manage_team'::user_capability)
  );

-- Writes happen only via apply_installment_payment (and future manual_credit RPCs).

GRANT SELECT ON public.customer_credits TO authenticated;

-- Per-customer net balance (positive = customer has credit on file).
CREATE OR REPLACE VIEW public.customer_credit_balance AS
SELECT
  customer_id,
  currency,
  sum(amount) AS balance
FROM public.customer_credits
GROUP BY customer_id, currency;

GRANT SELECT ON public.customer_credit_balance TO authenticated;

-- ============================================================================
-- apply_installment_payment(installment_id, amount, method, receipt_url, note)
--
-- One RPC call per "the customer handed us money for this installment."
-- Cumulative across multiple calls (partial pays + later top-ups).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_installment_payment(
  p_installment_id uuid,
  p_amount         numeric,
  p_payment_method text,
  p_receipt_url    text DEFAULT NULL,
  p_note           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_inst         public.installment_payments;
  v_plan         public.payment_plans;
  v_new_paid     numeric;
  v_overage      numeric := 0;
  v_new_status   public.installment_status;
  v_all_paid     boolean;
  v_owner_ids    uuid[];
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

  -- Overage → customer_credits ledger + audit
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
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_installment_payment(uuid, numeric, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_installment_payment(uuid, numeric, text, text, text)
  TO authenticated;
