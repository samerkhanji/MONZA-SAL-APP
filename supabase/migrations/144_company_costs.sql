-- Migration 144: Company Costs / Expenses module.
--
-- A company-wide income/expense ledger so owners can see the real cost of
-- running the business: per car, per supplier, per marketing campaign,
-- per garage job, and month-by-month profit & loss.
--
-- This is intentionally SEPARATE from the cash module (cash_sessions /
-- cash_movements), which only reconciles the physical cash drawer. A
-- company cost can be paid by any method (bank transfer, card, cheque,
-- cash) and is the accounting view, not the drawer view.
--
-- Two tables:
--   * marketing_campaigns — so marketing spend can be grouped by campaign.
--   * company_costs        — the income/expense ledger itself.

-- ============================================================================
-- 1) marketing_campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  platform        text,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  start_date      date,
  end_date        date,
  budget_amount   numeric CHECK (budget_amount IS NULL OR budget_amount >= 0),
  budget_currency text NOT NULL DEFAULT 'USD',
  related_car_id  uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status
  ON public.marketing_campaigns(status);

-- ============================================================================
-- 2) company_costs — the income / expense ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company_costs (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                          text NOT NULL CHECK (type IN ('income', 'expense')),
  category                      text NOT NULL
                                  CHECK (category IN ('marketing', 'car', 'parts',
                                                      'garage', 'operating', 'other')),
  subcategory                   text,
  amount                        numeric NOT NULL CHECK (amount >= 0),
  currency                      text NOT NULL DEFAULT 'USD',
  payment_method                text CHECK (payment_method IS NULL OR payment_method IN
                                  ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  description                   text,
  cost_date                     date NOT NULL DEFAULT CURRENT_DATE,
  related_car_id                uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  related_customer_id           uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  related_supplier_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  related_employee_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_garage_job_id         uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  related_sales_order_id        uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  related_purchase_order_id     uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  related_marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  receipt_url                   text,
  approval_status               text NOT NULL DEFAULT 'approved'
                                  CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by                   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at                   timestamptz,
  created_by                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_company_costs_cost_date
  ON public.company_costs(cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_company_costs_category
  ON public.company_costs(category);
CREATE INDEX IF NOT EXISTS idx_company_costs_type
  ON public.company_costs(type);
CREATE INDEX IF NOT EXISTS idx_company_costs_approval_status
  ON public.company_costs(approval_status);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_car
  ON public.company_costs(related_car_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_campaign
  ON public.company_costs(related_marketing_campaign_id);

-- ============================================================================
-- 3) Row level security
--
-- Read:  owner + view_reports + cashier + garage capability holders.
-- Write: owner + cashier + manage_team + garage (people who record costs).
-- Approve / edit / delete: owner only.
-- ============================================================================
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_costs       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY marketing_campaigns_sel ON public.marketing_campaigns
    FOR SELECT TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('view_reports'::user_capability)
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY marketing_campaigns_ins ON public.marketing_campaigns
    FOR INSERT TO authenticated
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('view_reports'::user_capability)
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY marketing_campaigns_upd ON public.marketing_campaigns
    FOR UPDATE TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('view_reports'::user_capability)
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY marketing_campaigns_del ON public.marketing_campaigns
    FOR DELETE TO authenticated
    USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY company_costs_sel ON public.company_costs
    FOR SELECT TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('view_reports'::user_capability)
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('garage'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY company_costs_ins ON public.company_costs
    FOR INSERT TO authenticated
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
      OR public.has_capability('garage'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY company_costs_upd ON public.company_costs
    FOR UPDATE TO authenticated
    USING (public.is_owner())
    WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY company_costs_del ON public.company_costs
    FOR DELETE TO authenticated
    USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_costs       TO authenticated;
