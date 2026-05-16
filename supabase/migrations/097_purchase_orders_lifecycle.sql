-- Phase B3: full purchase order lifecycle.
--
-- Tables (header + 4 children):
--   purchase_orders            — one row per PO (status, supplier, totals)
--   purchase_order_lines       — part × qty × unit_cost per line
--   purchase_order_receipts    — GRN events (could be multiple per PO)
--   purchase_order_receipt_lines — per-line received qty in each receipt
--   purchase_order_invoices    — supplier invoices attached to a PO
--   purchase_order_payments    — cash/transfer payments against invoices
--
-- Lifecycle:
--   draft → pending_approval → approved → sent_to_supplier
--          → partially_received → received → invoiced → paid
--   Branches: cancelled (any time before received), rejected (from pending).
--
-- Stock impact: parts.quantity ONLY bumps when a receipt line is recorded
-- with condition='good' or 'extra'. Creating a PO does NOT touch inventory.
--
-- Approval: uses required_approver('parts_order', total). Below threshold
-- auto-approves; at/above pushes to pending_approval and notifies owner.

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number           text NOT NULL UNIQUE,
  supplier_id         uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft','pending_approval','approved','sent_to_supplier',
      'partially_received','received','invoiced','paid',
      'cancelled','rejected'
    )),
  currency            text NOT NULL DEFAULT 'USD',
  estimated_total     numeric NOT NULL DEFAULT 0,
  related_job_id      uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  related_car_id      uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  notes               text,
  requested_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  rejected_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at         timestamptz,
  rejection_reason    text,
  sent_at             timestamptz,
  sent_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  supplier_contact    text,
  supplier_reference  text,
  expected_delivery_at date,
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancel_reason       text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
  ON public.purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
  ON public.purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_job
  ON public.purchase_orders(related_job_id) WHERE related_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id         uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  part_name       text NOT NULL,
  oe_number       text,
  quantity        numeric NOT NULL CHECK (quantity > 0),
  unit_cost       numeric NOT NULL DEFAULT 0,
  line_total      numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  note            text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines(po_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  grn_number      text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  received_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  condition_note  text,
  photos          text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_receipts_po ON public.purchase_order_receipts(po_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_receipt_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id      uuid NOT NULL REFERENCES public.purchase_order_receipts(id) ON DELETE CASCADE,
  po_line_id      uuid NOT NULL REFERENCES public.purchase_order_lines(id) ON DELETE CASCADE,
  quantity_received numeric NOT NULL CHECK (quantity_received >= 0),
  condition       text NOT NULL DEFAULT 'good'
    CHECK (condition IN ('good','damaged','wrong_item','extra','short')),
  note            text
);

CREATE INDEX IF NOT EXISTS idx_po_receipt_lines_receipt
  ON public.purchase_order_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_po_receipt_lines_line
  ON public.purchase_order_receipt_lines(po_line_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_invoice_number text NOT NULL,
  invoice_date    date NOT NULL,
  amount          numeric NOT NULL CHECK (amount >= 0),
  currency        text NOT NULL DEFAULT 'USD',
  vat_amount      numeric NOT NULL DEFAULT 0,
  due_at          date,
  file_url        text,
  status          text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','disputed','approved_for_payment','paid')),
  attached_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_invoices_po ON public.purchase_order_invoices(po_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_po_invoice_number
  ON public.purchase_order_invoices(po_id, supplier_invoice_number);

CREATE TABLE IF NOT EXISTS public.purchase_order_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES public.purchase_order_invoices(id) ON DELETE SET NULL,
  amount          numeric NOT NULL CHECK (amount > 0),
  currency        text NOT NULL DEFAULT 'USD',
  payment_method  text NOT NULL CHECK (payment_method IN ('cash','bank_transfer','cheque','card','other')),
  reference       text,
  paid_at         timestamptz NOT NULL DEFAULT now(),
  paid_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_payments_po ON public.purchase_order_payments(po_id);

-- RLS

ALTER TABLE public.purchase_orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_receipts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_payments     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY po_sel ON public.purchase_orders
    FOR SELECT TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_write ON public.purchase_orders
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_lines_all ON public.purchase_order_lines
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_receipts_all ON public.purchase_order_receipts
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_receipt_lines_all ON public.purchase_order_receipt_lines
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_invoices_all ON public.purchase_order_invoices
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('inventory'::user_capability)
      OR public.has_capability('cashier'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_payments_all ON public.purchase_order_payments
    FOR ALL TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('cashier'::user_capability)
    )
    WITH CHECK (
      public.is_owner()
      OR public.has_capability('cashier'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.purchase_orders,
     public.purchase_order_lines,
     public.purchase_order_receipts,
     public.purchase_order_receipt_lines,
     public.purchase_order_invoices,
     public.purchase_order_payments
  TO authenticated;

-- PO number generator

CREATE SEQUENCE IF NOT EXISTS public.po_number_seq AS bigint START 1000;

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT 'PO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
$function$;

-- Notification rules

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('purchase_order.needs_owner_approval',
     'Purchase order needs owner approval',
     'approval','urgent','role','owner', true, false, false,
     'Owner — total >= parts_order threshold'),
  ('purchase_order.approved',
     'Purchase order approved — ready to send',
     'approval','info','event_subject_owner', NULL, true, false, false,
     'Requester sees the green light'),
  ('purchase_order.rejected',
     'Purchase order rejected by owner',
     'approval','warning','event_subject_owner', NULL, true, false, false,
     'Requester sees the rejection with reason'),
  ('purchase_order.received_partial',
     'Partial receipt logged',
     'status_change','info','event_subject_owner', NULL, true, false, false,
     'Requester sees partial GRN'),
  ('purchase_order.received_full',
     'PO fully received',
     'status_change','info','event_subject_owner', NULL, true, false, false,
     'Requester sees full GRN'),
  ('purchase_order.invoice_attached',
     'Supplier invoice attached',
     'alert','info','role','owner', true, false, false,
     'Owner sees what to pay'),
  ('purchase_order.invoice_attached',
     'Supplier invoice attached',
     'alert','info','capability','cashier', true, false, false,
     'Cashier sees what to pay')
ON CONFLICT DO NOTHING;
