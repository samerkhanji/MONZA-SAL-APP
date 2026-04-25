-- Migration 056: sales pipeline lifecycle.
--
-- Adds the columns and trigger needed to take a sale from quote → deposit →
-- contract → delivery without anything happening on WhatsApp/paper.

-- 1. Quote lifecycle
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS quote_amount         numeric,
  ADD COLUMN IF NOT EXISTS quote_currency       text,
  ADD COLUMN IF NOT EXISTS quote_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at    timestamptz;

-- 2. Deposit details (deposit_amount already exists)
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS deposit_currency     text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at      timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_method       text;

-- 3. Delivery completion (separate from planned delivery_date)
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS delivered_at         timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by         uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS delivery_notes       text;

-- 4. Signed contract pointer
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS signed_contract_url  text,
  ADD COLUMN IF NOT EXISTS contract_signed_at   timestamptz;

-- 5. Auto-advance customer lead_status when a test drive returns.
-- Idempotent: only moves the lead if it's still at 'test_drive', so a manual
-- update can't be undone.
CREATE OR REPLACE FUNCTION public.advance_lead_on_test_drive_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'returned'
     AND (OLD.status IS NULL OR OLD.status <> 'returned')
     AND NEW.customer_id IS NOT NULL
  THEN
    UPDATE public.customers
       SET lead_status = 'negotiation', updated_at = now()
     WHERE id = NEW.customer_id
       AND lead_status = 'test_drive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS test_drive_advance_lead ON public.test_drives;
CREATE TRIGGER test_drive_advance_lead
  AFTER UPDATE OF status ON public.test_drives
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_lead_on_test_drive_return();

-- 6. RPC: complete_delivery — atomic delivery completion.
-- Stamps delivered_at + delivered_by + notes, advances order status to
-- 'delivered', flips customer lead_status to 'converted', writes a car_event.
-- Allowed for owner / assistant / sales_ops / hybrid.
CREATE OR REPLACE FUNCTION public.complete_delivery(
  p_sales_order_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_so       public.sales_orders;
  v_caller   uuid := auth.uid();
  v_role     user_role;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT user_role INTO v_role FROM public.profiles WHERE id = v_caller;
  IF v_role IS NULL OR v_role NOT IN ('owner','assistant','sales_ops','hybrid') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_order % not found', p_sales_order_id USING ERRCODE = '02000';
  END IF;
  IF v_so.delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already delivered at %', v_so.delivered_at USING ERRCODE = '40000';
  END IF;

  UPDATE public.sales_orders
     SET delivered_at   = now(),
         delivered_by   = v_caller,
         delivery_notes = p_notes,
         status         = 'delivered'::sale_status,
         updated_at     = now()
   WHERE id = p_sales_order_id;

  IF v_so.customer_id IS NOT NULL THEN
    UPDATE public.customers
       SET lead_status = 'converted'::lead_status, updated_at = now()
     WHERE id = v_so.customer_id
       AND lead_status NOT IN ('converted','lost');
  END IF;

  IF v_so.car_id IS NOT NULL THEN
    INSERT INTO public.car_events (car_id, event_type, to_value, note, created_by)
    VALUES (
      v_so.car_id,
      'status_changed'::car_event_type,
      'delivered',
      COALESCE('Delivery: ' || p_notes, 'Delivery completed'),
      v_caller
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
