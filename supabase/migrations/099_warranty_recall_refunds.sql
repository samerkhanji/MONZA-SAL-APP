-- ============================================================================
-- B7 — warranty cases, recalls, parts/service refunds
-- Schema + indexes + RLS + sequences + number generators.
-- RPCs land in 099b.
--
-- Scope:
--   * warranty cases linked to car (VIN), customer, job, parts, photos, status
--   * recalls tracked by affected VINs and completion status
--   * refunds for parts and service only (NO full car returns)
--   * owner approval gate via approval_thresholds where money is involved
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RECALLS (declared first so warranty_cases.recall_id can FK it)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recalls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_number   text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  manufacturer    text DEFAULT 'Dongfeng',
  affected_models text[],
  model_year_min  integer,
  model_year_max  integer,
  required_parts  text,
  estimated_labor_hours numeric(5,2),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','active','closed','cancelled')),
  opened_at       timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS recalls_status_idx ON public.recalls (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS recalls_opened_at_idx ON public.recalls (opened_at DESC);

-- ---------------------------------------------------------------------------
-- WARRANTY CASES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warranty_cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number     text UNIQUE NOT NULL,
  car_id          uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  recall_id       uuid REFERENCES public.recalls(id) ON DELETE SET NULL,
  kind            text NOT NULL DEFAULT 'manufacturer'
                    CHECK (kind IN ('manufacturer','battery','dealer_goodwill','recall')),
  severity        text NOT NULL DEFAULT 'normal'
                    CHECK (severity IN ('low','normal','high','critical')),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','awaiting_parts','in_repair','completed','rejected','cancelled')),
  summary         text NOT NULL,
  notes           text,
  resolution      text,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  opened_by       uuid REFERENCES auth.users(id),
  closed_at       timestamptz,
  closed_by       uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS warranty_cases_car_idx ON public.warranty_cases (car_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warranty_cases_customer_idx ON public.warranty_cases (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warranty_cases_job_idx ON public.warranty_cases (job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warranty_cases_status_idx ON public.warranty_cases (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warranty_cases_opened_at_idx ON public.warranty_cases (opened_at DESC);

CREATE TABLE IF NOT EXISTS public.warranty_case_parts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES public.warranty_cases(id) ON DELETE CASCADE,
  part_id         uuid REFERENCES public.parts(id),
  description     text NOT NULL,
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_cost       numeric(12,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS warranty_case_parts_case_idx ON public.warranty_case_parts (case_id);

CREATE TABLE IF NOT EXISTS public.warranty_case_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES public.warranty_cases(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  filename        text NOT NULL,
  mime_type       text,
  size_bytes      integer,
  kind            text NOT NULL DEFAULT 'photo'
                    CHECK (kind IN ('photo','document','report')),
  caption         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS warranty_case_documents_case_idx ON public.warranty_case_documents (case_id);

-- ---------------------------------------------------------------------------
-- RECALL VEHICLES (per-VIN completion status)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recall_vehicles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id       uuid NOT NULL REFERENCES public.recalls(id) ON DELETE CASCADE,
  car_id          uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','customer_notified','scheduled','in_progress','completed','not_applicable','customer_refused')),
  notified_at     timestamptz,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  completed_by    uuid REFERENCES auth.users(id),
  job_id          uuid REFERENCES public.garage_jobs(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recall_id, car_id)
);

CREATE INDEX IF NOT EXISTS recall_vehicles_car_idx ON public.recall_vehicles (car_id);
CREATE INDEX IF NOT EXISTS recall_vehicles_status_idx ON public.recall_vehicles (status);

-- ---------------------------------------------------------------------------
-- REFUNDS (parts and service only — no full car returns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number   text UNIQUE NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('parts','service')),
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  job_id          uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  invoice_id      uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  warranty_case_id uuid REFERENCES public.warranty_cases(id) ON DELETE SET NULL,
  part_id         uuid REFERENCES public.parts(id),
  quantity        integer CHECK (quantity IS NULL OR quantity > 0),
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  currency        text NOT NULL DEFAULT 'USD',
  reason          text NOT NULL,
  notes           text,
  approval_required text NOT NULL
                    CHECK (approval_required IN ('auto','manager','owner')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','paid','cancelled')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  requested_by    uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  approved_by     uuid REFERENCES auth.users(id),
  rejected_at     timestamptz,
  rejected_by     uuid REFERENCES auth.users(id),
  rejection_reason text,
  paid_at         timestamptz,
  paid_by         uuid REFERENCES auth.users(id),
  payment_method  text CHECK (payment_method IN ('cash','bank','credit','other')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS refunds_customer_idx ON public.refunds (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS refunds_job_idx ON public.refunds (job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS refunds_requested_at_idx ON public.refunds (requested_at DESC);
CREATE INDEX IF NOT EXISTS refunds_warranty_case_idx ON public.refunds (warranty_case_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER warranty_cases_set_updated_at BEFORE UPDATE ON public.warranty_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER recalls_set_updated_at BEFORE UPDATE ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER recall_vehicles_set_updated_at BEFORE UPDATE ON public.recall_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Approval threshold for refunds
-- ---------------------------------------------------------------------------
INSERT INTO public.approval_thresholds
  (id, label_en, description, currency, manager_floor, owner_floor)
VALUES
  ('refund',
   'Parts or service refund',
   'Refund amount above manager_floor needs manager; above owner_floor needs owner.',
   'USD', 50, 500)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sequences + number generators
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.warranty_case_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.recall_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.refund_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_warranty_case_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'WC-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.warranty_case_number_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_recall_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'RCL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.recall_number_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_refund_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'RF-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.refund_number_seq')::text, 4, '0');
$$;

GRANT EXECUTE ON FUNCTION public.generate_warranty_case_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recall_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_refund_number() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.warranty_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_case_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warranty_cases_sel ON public.warranty_cases;
CREATE POLICY warranty_cases_sel ON public.warranty_cases FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS warranty_case_parts_sel ON public.warranty_case_parts;
CREATE POLICY warranty_case_parts_sel ON public.warranty_case_parts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS warranty_case_documents_sel ON public.warranty_case_documents;
CREATE POLICY warranty_case_documents_sel ON public.warranty_case_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS recalls_sel ON public.recalls;
CREATE POLICY recalls_sel ON public.recalls FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS recall_vehicles_sel ON public.recall_vehicles;
CREATE POLICY recall_vehicles_sel ON public.recall_vehicles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS refunds_sel ON public.refunds;
CREATE POLICY refunds_sel ON public.refunds FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS warranty_cases_write ON public.warranty_cases;
CREATE POLICY warranty_cases_write ON public.warranty_cases
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('garage'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability));

DROP POLICY IF EXISTS warranty_case_parts_write ON public.warranty_case_parts;
CREATE POLICY warranty_case_parts_write ON public.warranty_case_parts
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('garage'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability));

DROP POLICY IF EXISTS warranty_case_documents_write ON public.warranty_case_documents;
CREATE POLICY warranty_case_documents_write ON public.warranty_case_documents
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('garage'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability));

DROP POLICY IF EXISTS recalls_write ON public.recalls;
CREATE POLICY recalls_write ON public.recalls
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('garage'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability));

DROP POLICY IF EXISTS recall_vehicles_write ON public.recall_vehicles;
CREATE POLICY recall_vehicles_write ON public.recall_vehicles
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('garage'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability));

-- Refunds: anyone with garage/cashier can REQUEST. Approval/rejection/
-- mark-paid is funneled through RPCs (SECURITY DEFINER) that enforce the
-- approval_thresholds gate, so direct UPDATE/DELETE is owner-only.
DROP POLICY IF EXISTS refunds_write ON public.refunds;
CREATE POLICY refunds_write ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.has_capability('garage'::user_capability) OR public.has_capability('cashier'::user_capability));

DROP POLICY IF EXISTS refunds_update_owner ON public.refunds;
CREATE POLICY refunds_update_owner ON public.refunds
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS refunds_delete_owner ON public.refunds;
CREATE POLICY refunds_delete_owner ON public.refunds
  FOR DELETE TO authenticated
  USING (public.is_owner());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_case_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_case_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recalls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recall_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
