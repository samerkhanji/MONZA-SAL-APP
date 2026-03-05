-- ============================================
-- MONZA CRM - Installments & Payment Plans
-- Migration 016: tables, RLS, owner/assistant rules
-- ============================================

-- 1) Create payment_plans table

CREATE TABLE IF NOT EXISTS public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  car_id UUID NOT NULL REFERENCES public.cars(id),
  status TEXT NOT NULL DEFAULT 'active',
  total_amount NUMERIC(12,2) NOT NULL,
  down_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_amount NUMERIC(12,2) NOT NULL,
  months INTEGER NOT NULL,
  start_date DATE NOT NULL,
  due_day INTEGER NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_customer_id
  ON public.payment_plans(customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_plans_car_id
  ON public.payment_plans(car_id);


-- 2) Create installment_payments table

CREATE TABLE IF NOT EXISTS public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount_due NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12,2),
  payment_method TEXT,
  receipt_url TEXT,
  note TEXT,
  marked_paid_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_plan_id
  ON public.installment_payments(plan_id);

CREATE INDEX IF NOT EXISTS idx_installments_due_date
  ON public.installment_payments(due_date);

CREATE INDEX IF NOT EXISTS idx_installments_status
  ON public.installment_payments(status);


-- 3) Enable RLS

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;


-- Basic visibility: reuse generic role helpers if present

DROP POLICY IF EXISTS "plans_select_all_roles" ON public.payment_plans;
CREATE POLICY "plans_select_all_roles"
ON public.payment_plans
FOR SELECT
USING (public.is_any_role(ARRAY['owner','assistant','sales_ops']::public.user_role[]));

DROP POLICY IF EXISTS "installments_select_all_roles" ON public.installment_payments;
CREATE POLICY "installments_select_all_roles"
ON public.installment_payments
FOR SELECT
USING (public.is_any_role(ARRAY['owner','assistant','sales_ops']::public.user_role[]));


-- Insert: owner, assistant, sales_ops

DROP POLICY IF EXISTS "plans_insert_owner_assistant_sales" ON public.payment_plans;
CREATE POLICY "plans_insert_owner_assistant_sales"
ON public.payment_plans
FOR INSERT
WITH CHECK (public.is_any_role(ARRAY['owner','assistant','sales_ops']::public.user_role[]));

DROP POLICY IF EXISTS "installments_insert_owner_assistant_sales" ON public.installment_payments;
CREATE POLICY "installments_insert_owner_assistant_sales"
ON public.installment_payments
FOR INSERT
WITH CHECK (public.is_any_role(ARRAY['owner','assistant','sales_ops']::public.user_role[]));


-- 4) Update + delete policies as requested

-- Drop the owner-only update policy and replace with owner + assistant
DROP POLICY IF EXISTS "plans_update_owner_only" ON public.payment_plans;
CREATE POLICY "plans_update_owner_assistant"
ON public.payment_plans
FOR UPDATE
USING (public.is_any_role(ARRAY['owner','assistant']::public.user_role[]))
WITH CHECK (public.is_any_role(ARRAY['owner','assistant']::public.user_role[]));

-- Add delete policy for owners only
DROP POLICY IF EXISTS "plans_delete_owner_only" ON public.payment_plans;
CREATE POLICY "plans_delete_owner_only"
ON public.payment_plans
FOR DELETE
USING (public.is_role('owner'));

DROP POLICY IF EXISTS "payments_delete_owner_only" ON public.installment_payments;
CREATE POLICY "payments_delete_owner_only"
ON public.installment_payments
FOR DELETE
USING (public.is_role('owner'));

