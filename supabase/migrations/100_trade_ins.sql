-- ============================================================================
-- B4 — trade-ins (provisional → inspected → owner-approved → committed)
--
-- Strict workflow:
--   1. Sales creates a trade-in. Value is provisional only.
--   2. Garage opens inspection, then completes it with photos, mileage,
--      condition, issues, estimated repair cost, and recommended value.
--   3. Owner approves with an accepted_value (or rejects).
--   4. Trade-in can then be committed against a sales_order — applying the
--      accepted_value as a credit toward selling_price.
--
-- Sales-order numbers are NEVER affected by a trade-in until it has been
-- both inspected AND owner-approved.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trade_ins (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_in_number          text UNIQUE NOT NULL,

  customer_id              uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,

  -- vehicle details (free-form — trade-in vehicle is NOT in our cars table)
  vehicle_make             text NOT NULL,
  vehicle_model            text NOT NULL,
  vehicle_year             integer,
  vehicle_vin              text,
  vehicle_plate            text,
  vehicle_color            text,
  vehicle_trim             text,
  mileage_km               integer CHECK (mileage_km IS NULL OR mileage_km >= 0),

  -- values
  currency                 text NOT NULL DEFAULT 'USD',
  provisional_value        numeric(12,2) NOT NULL CHECK (provisional_value >= 0),
  recommended_value        numeric(12,2) CHECK (recommended_value IS NULL OR recommended_value >= 0),
  estimated_repair_cost    numeric(12,2) CHECK (estimated_repair_cost IS NULL OR estimated_repair_cost >= 0),
  accepted_value           numeric(12,2) CHECK (accepted_value IS NULL OR accepted_value >= 0),

  -- inspection
  condition                text CHECK (condition IS NULL OR condition IN ('excellent','good','fair','poor','salvage')),
  inspection_notes         text,

  -- lifecycle
  status                   text NOT NULL DEFAULT 'provisional'
                              CHECK (status IN ('provisional','inspecting','inspected','approved','rejected','cancelled','committed')),

  -- per-state actors + timestamps
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),

  inspection_started_by    uuid REFERENCES auth.users(id),
  inspection_started_at    timestamptz,

  inspected_by             uuid REFERENCES auth.users(id),
  inspected_at             timestamptz,

  approved_by              uuid REFERENCES auth.users(id),
  approved_at              timestamptz,

  rejected_by              uuid REFERENCES auth.users(id),
  rejected_at              timestamptz,
  rejection_reason         text,

  cancelled_by             uuid REFERENCES auth.users(id),
  cancelled_at             timestamptz,
  cancellation_reason      text,

  -- linkage to the sale that consumes this trade-in
  linked_sales_order_id    uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  committed_at             timestamptz,
  committed_by             uuid REFERENCES auth.users(id),

  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,

  CONSTRAINT trade_ins_committed_has_link
    CHECK (status <> 'committed' OR linked_sales_order_id IS NOT NULL),
  CONSTRAINT trade_ins_committed_has_value
    CHECK (status <> 'committed' OR accepted_value IS NOT NULL),
  CONSTRAINT trade_ins_approved_has_value
    CHECK (status NOT IN ('approved','committed') OR accepted_value IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trade_ins_customer_idx ON public.trade_ins (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS trade_ins_status_idx ON public.trade_ins (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS trade_ins_sale_idx ON public.trade_ins (linked_sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS trade_ins_created_at_idx ON public.trade_ins (created_at DESC);

CREATE TRIGGER trade_ins_set_updated_at BEFORE UPDATE ON public.trade_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.trade_in_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_in_id     uuid NOT NULL REFERENCES public.trade_ins(id) ON DELETE CASCADE,
  description     text NOT NULL,
  severity        text NOT NULL DEFAULT 'minor'
                    CHECK (severity IN ('cosmetic','minor','major','safety')),
  estimated_cost  numeric(12,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS trade_in_issues_trade_in_idx ON public.trade_in_issues (trade_in_id);

CREATE TABLE IF NOT EXISTS public.trade_in_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_in_id     uuid NOT NULL REFERENCES public.trade_ins(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  filename        text NOT NULL,
  mime_type       text,
  size_bytes      integer,
  kind            text NOT NULL DEFAULT 'photo'
                    CHECK (kind IN ('photo','document','report','inspection_report')),
  caption         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS trade_in_documents_trade_in_idx ON public.trade_in_documents (trade_in_id);

CREATE SEQUENCE IF NOT EXISTS public.trade_in_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_trade_in_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'TI-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.trade_in_number_seq')::text, 4, '0');
$$;

GRANT EXECUTE ON FUNCTION public.generate_trade_in_number() TO authenticated;

ALTER TABLE public.trade_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_in_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_in_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_ins_sel ON public.trade_ins;
CREATE POLICY trade_ins_sel ON public.trade_ins FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS trade_in_issues_sel ON public.trade_in_issues;
CREATE POLICY trade_in_issues_sel ON public.trade_in_issues FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS trade_in_documents_sel ON public.trade_in_documents;
CREATE POLICY trade_in_documents_sel ON public.trade_in_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS trade_ins_ins ON public.trade_ins;
CREATE POLICY trade_ins_ins ON public.trade_ins
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    OR public.has_capability('sales'::user_capability)
  );

DROP POLICY IF EXISTS trade_ins_upd_owner ON public.trade_ins;
CREATE POLICY trade_ins_upd_owner ON public.trade_ins
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS trade_ins_del_owner ON public.trade_ins;
CREATE POLICY trade_ins_del_owner ON public.trade_ins
  FOR DELETE TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS trade_in_issues_write ON public.trade_in_issues;
CREATE POLICY trade_in_issues_write ON public.trade_in_issues
  FOR ALL TO authenticated
  USING (
    public.is_owner()
    OR public.has_capability('garage'::user_capability)
    OR public.has_capability('sales'::user_capability)
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_capability('garage'::user_capability)
    OR public.has_capability('sales'::user_capability)
  );

DROP POLICY IF EXISTS trade_in_documents_write ON public.trade_in_documents;
CREATE POLICY trade_in_documents_write ON public.trade_in_documents
  FOR ALL TO authenticated
  USING (
    public.is_owner()
    OR public.has_capability('garage'::user_capability)
    OR public.has_capability('sales'::user_capability)
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_capability('garage'::user_capability)
    OR public.has_capability('sales'::user_capability)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_ins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_in_issues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_in_documents TO authenticated;
