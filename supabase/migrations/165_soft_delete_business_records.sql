-- ============================================
-- Monza S.A.L. — soft-delete on business / audit-sensitive tables
-- Migration 165 (decision 4)
--
-- Per the owner's explicit decision, every business / audit-sensitive
-- table must support a soft-delete pattern instead of a hard DELETE.
-- Hard DELETE remains blocked by the BEFORE DELETE trigger installed in
-- migration 156 (block_hard_delete_financial); RLS DELETE policies stay
-- as-is so any accidental DELETE still hits the trigger and is refused
-- with a clear error.
--
-- This migration:
--   1. Adds three soft-delete columns to every target table that does
--      not already have them:
--        - deleted_at    timestamptz
--        - deleted_by    uuid REFERENCES auth.users(id)
--        - delete_reason text
--   2. Updates SELECT policies so deleted rows are hidden from
--      non-owners (owners retain visibility for audit).
--   3. Adds a SECURITY DEFINER soft_delete_<table>(p_id, p_reason) RPC
--      per table. The RPC verifies caller capability before flipping
--      deleted_at; non-owners are refused. Hard DELETE remains blocked
--      by trigger; the RPC performs an UPDATE so it is unaffected.
--   4. Revokes EXECUTE from PUBLIC/anon and grants only to authenticated.
--
-- Frontend integration notes: see PR description. Existing endpoints
-- that already UPDATE deleted_at directly (customers, garage_jobs)
-- continue to work; new RPCs are the preferred path for new code and
-- for tables that had no soft-delete pathway before.
-- ============================================

-- ---------- 1. ADD COLUMNS ----------
-- customers, garage_jobs, purchase_orders, refunds, trade_ins already
-- have deleted_at. None have deleted_by / delete_reason. We add what is
-- missing using IF NOT EXISTS so the migration is fully idempotent.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customers',
    'sales_orders',
    'invoices',
    'cash_movements',
    'refunds',
    'installment_payments',
    'trade_ins',
    'garage_jobs',
    'purchase_orders'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id)', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS delete_reason text', tbl);

    -- Partial index on (deleted_at) helps the common "WHERE deleted_at IS NULL" filter.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL',
      tbl || '_deleted_at_idx', tbl
    );
  END LOOP;
END $$;


-- ---------- 2. SELECT POLICIES (hide soft-deleted rows from non-owners) ----------
-- Owners always see deleted rows so audit / restore is possible.
-- customers, refunds, trade_ins already filter deleted_at — but they
-- hide rows from OWNERS too, which we want to relax. We re-create
-- those policies so owners can still see deleted rows.

-- customers
DROP POLICY IF EXISTS customers_select_by_role ON public.customers;
CREATE POLICY customers_select_by_role ON public.customers
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND (
    is_owner()
    OR has_role('sales'::user_role)
    OR has_role('sales_ops'::user_role)
    OR has_role('hybrid'::user_role)
    OR has_role('khalil_hybrid'::user_role)
    OR has_role('assistant'::user_role)
    OR (
      has_role('garage_manager'::user_role)
      AND EXISTS (
        SELECT 1
        FROM sales_orders so
        JOIN garage_jobs gj ON gj.car_id = so.car_id
        WHERE so.customer_id = customers.id
      )
    )
  )
);

-- sales_orders
DROP POLICY IF EXISTS sales_orders_select_sales_roles ON public.sales_orders;
CREATE POLICY sales_orders_select_sales_roles ON public.sales_orders
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role])
);

-- invoices (current qual is `true` — keep open visibility but hide deleted from non-owners)
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
FOR SELECT
USING (deleted_at IS NULL OR is_owner());

-- cash_movements
DROP POLICY IF EXISTS cash_movements_sel ON public.cash_movements;
CREATE POLICY cash_movements_sel ON public.cash_movements
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND (
    is_owner()
    OR has_capability('cashier'::user_capability)
    OR has_capability('manage_team'::user_capability)
    OR has_capability('view_reports'::user_capability)
  )
);

-- refunds
DROP POLICY IF EXISTS refunds_sel ON public.refunds;
CREATE POLICY refunds_sel ON public.refunds
FOR SELECT
USING (deleted_at IS NULL OR is_owner());

-- installment_payments
DROP POLICY IF EXISTS installment_payments_select_secure ON public.installment_payments;
CREATE POLICY installment_payments_select_secure ON public.installment_payments
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND (
    EXISTS (
      SELECT 1 FROM payment_plans pp
      WHERE pp.id = installment_payments.plan_id
        AND pp.created_by = (SELECT auth.uid())
    )
    OR (SELECT is_any_role_resolved(ARRAY['owner'::user_role, 'assistant'::user_role, 'sales_ops'::user_role]))
  )
);

-- trade_ins
DROP POLICY IF EXISTS trade_ins_sel ON public.trade_ins;
CREATE POLICY trade_ins_sel ON public.trade_ins
FOR SELECT
USING (deleted_at IS NULL OR is_owner());

-- garage_jobs
DROP POLICY IF EXISTS garage_jobs_select_access ON public.garage_jobs;
CREATE POLICY garage_jobs_select_access ON public.garage_jobs
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND is_any_role_resolved(ARRAY[
    'owner'::user_role,
    'garage_manager'::user_role,
    'sales_ops'::user_role,
    'assistant'::user_role,
    'hybrid'::user_role,
    'garage_staff'::user_role
  ])
);

-- purchase_orders
DROP POLICY IF EXISTS po_sel ON public.purchase_orders;
CREATE POLICY po_sel ON public.purchase_orders
FOR SELECT
USING (
  (deleted_at IS NULL OR is_owner())
  AND (
    is_owner()
    OR has_capability('inventory'::user_capability)
    OR has_capability('manage_team'::user_capability)
    OR has_capability('cashier'::user_capability)
  )
);


-- ---------- 3. SOFT-DELETE RPCs ----------
-- All RPCs share the same shape:
--   * SECURITY DEFINER (bypasses RLS so the UPDATE always succeeds for
--     authorized callers; the capability check inside the function
--     is the real gate).
--   * SET search_path = public, pg_temp (mandatory hardening per
--     migration 146).
--   * REVOKE EXECUTE FROM PUBLIC, anon; GRANT to authenticated only.
--   * Raises 42501 'insufficient privileges' when the caller is not
--     authorized.
--   * Raises 'row not found or already deleted' when the row does not
--     exist or is already soft-deleted (so callers can surface a
--     useful error).

-- Helper: who-am-i value used inside the RPCs.
-- (auth.uid() is wrapped in SELECT to allow plan caching.)

-- soft_delete_customers — owner-only
CREATE OR REPLACE FUNCTION public.soft_delete_customers(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.customers
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_customers(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_customers(uuid, text) TO authenticated;

-- soft_delete_sales_orders — owner-only (audit-sensitive financial record)
CREATE OR REPLACE FUNCTION public.soft_delete_sales_orders(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sales_orders
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_sales_orders(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_sales_orders(uuid, text) TO authenticated;

-- soft_delete_invoices — owner-only
CREATE OR REPLACE FUNCTION public.soft_delete_invoices(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.invoices
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_invoices(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_invoices(uuid, text) TO authenticated;

-- soft_delete_cash_movements — owner-only (cash ledger is audit-critical)
CREATE OR REPLACE FUNCTION public.soft_delete_cash_movements(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cash_movements
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_cash_movements(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_cash_movements(uuid, text) TO authenticated;

-- soft_delete_refunds — owner-only
CREATE OR REPLACE FUNCTION public.soft_delete_refunds(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.refunds
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_refunds(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_refunds(uuid, text) TO authenticated;

-- soft_delete_installment_payments — owner-only
CREATE OR REPLACE FUNCTION public.soft_delete_installment_payments(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.installment_payments
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_installment_payments(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_installment_payments(uuid, text) TO authenticated;

-- soft_delete_trade_ins — owner-only
CREATE OR REPLACE FUNCTION public.soft_delete_trade_ins(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.trade_ins
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_trade_ins(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_trade_ins(uuid, text) TO authenticated;

-- soft_delete_garage_jobs — owner-only (matches existing DELETE policy)
CREATE OR REPLACE FUNCTION public.soft_delete_garage_jobs(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.garage_jobs
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_garage_jobs(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_garage_jobs(uuid, text) TO authenticated;

-- soft_delete_purchase_orders — owner OR inventory capability (matches existing po_del policy)
CREATE OR REPLACE FUNCTION public.soft_delete_purchase_orders(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (is_owner() OR has_capability('inventory'::user_capability)) THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  UPDATE public.purchase_orders
  SET deleted_at = now(), deleted_by = (SELECT auth.uid()), delete_reason = p_reason
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found or already deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_purchase_orders(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_purchase_orders(uuid, text) TO authenticated;


COMMENT ON FUNCTION public.soft_delete_customers(uuid, text)            IS 'Soft-delete a customer record. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_sales_orders(uuid, text)         IS 'Soft-delete a sales order. Owner-only; prefer void_sales_order() for the normal cancel flow.';
COMMENT ON FUNCTION public.soft_delete_invoices(uuid, text)             IS 'Soft-delete an invoice. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_cash_movements(uuid, text)       IS 'Soft-delete a cash movement. Owner-only; cash ledger is audit-critical.';
COMMENT ON FUNCTION public.soft_delete_refunds(uuid, text)              IS 'Soft-delete a refund. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_installment_payments(uuid, text) IS 'Soft-delete an installment payment. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_trade_ins(uuid, text)            IS 'Soft-delete a trade-in. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_garage_jobs(uuid, text)          IS 'Soft-delete a garage job. Owner-only.';
COMMENT ON FUNCTION public.soft_delete_purchase_orders(uuid, text)      IS 'Soft-delete a parts purchase order. Owner OR inventory capability.';
