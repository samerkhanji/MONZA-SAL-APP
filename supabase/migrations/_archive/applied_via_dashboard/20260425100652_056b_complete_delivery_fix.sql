-- ============================================
-- MONZA CRM - Backfill of dashboard-applied migration
-- Applied to prod: 20260425100652 as `056b_complete_delivery_fix`
-- Backfilled into repo: 2026-04-29
-- This file is for audit/reproducibility. The DDL was already applied
-- via the Supabase Dashboard SQL editor. A fresh `supabase db reset`
-- will replay these in chronological order alongside the canonical
-- numbered migrations.
-- ============================================

-- Fix complete_delivery RPC: real enum is sale_status with value 'delivered',
-- not sales_order_status with value 'completed'.
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
