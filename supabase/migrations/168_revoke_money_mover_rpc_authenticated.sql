-- Launch security Decision 2 (audit, 2026-06-02):
-- The 7 money-mover RPCs below are now invoked ONLY from Next.js Server
-- Actions (see web/src/lib/server/actions/money-mover.ts). Direct browser
-- calls via supabase.rpc() are blocked from the database layer by revoking
-- EXECUTE from the `authenticated` role.
--
-- Server Actions still need to invoke these RPCs server-side AND have the
-- original RPC's internal `auth.uid()` resolve to the verified user. To
-- preserve that semantic without modifying the original RPC bodies, we add
-- a thin `_srv_<rpc>` wrapper for each RPC. Each wrapper:
--   - accepts `p_acting_user_id uuid` as its first parameter
--   - executes as SECURITY DEFINER, owned by postgres
--   - sets `request.jwt.claims` LOCALLY with a sub claim equal to the
--     passed user id, so `auth.uid()` inside the original RPC returns it
--   - calls the underlying RPC unchanged
--   - has EXECUTE granted ONLY to `service_role` (never `authenticated`)
--
-- The Server Action verifies the user via the cookie-bound supabase client
-- BEFORE invoking the wrapper with that user's id via the service-role
-- client.
--
-- Internal capability gates inside the underlying RPCs (is_owner(),
-- has_capability(), etc.) remain intact — they are now the deepest layer.

BEGIN;

-- =============================================================================
-- 1. _srv_record_manual_cash_movement
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_record_manual_cash_movement(
  p_acting_user_id uuid,
  p_kind text,
  p_direction text,
  p_amount numeric,
  p_note text DEFAULT NULL,
  p_drawer_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result uuid;
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  SELECT public.record_manual_cash_movement(
    p_kind       := p_kind,
    p_direction  := p_direction,
    p_amount     := p_amount,
    p_note       := p_note,
    p_drawer_id  := p_drawer_id
  ) INTO v_result;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public._srv_record_manual_cash_movement(uuid, text, text, numeric, text, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_record_manual_cash_movement(uuid, text, text, numeric, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_record_manual_cash_movement(uuid, text, text, numeric, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._srv_record_manual_cash_movement(uuid, text, text, numeric, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_record_manual_cash_movement(uuid, text, text, numeric, text, uuid) TO service_role;

-- =============================================================================
-- 2. _srv_submit_purchase_order
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_submit_purchase_order(
  p_acting_user_id uuid,
  p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  SELECT public.submit_purchase_order(p_po_id := p_po_id) INTO v_result;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public._srv_submit_purchase_order(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_submit_purchase_order(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_submit_purchase_order(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._srv_submit_purchase_order(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_submit_purchase_order(uuid, uuid) TO service_role;

-- =============================================================================
-- 3. _srv_approve_refund
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_approve_refund(
  p_acting_user_id uuid,
  p_refund_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.approve_refund(p_refund_id := p_refund_id);
END;
$$;
ALTER FUNCTION public._srv_approve_refund(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_approve_refund(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_approve_refund(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._srv_approve_refund(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_approve_refund(uuid, uuid) TO service_role;

-- =============================================================================
-- 4. _srv_reject_refund
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_reject_refund(
  p_acting_user_id uuid,
  p_refund_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.reject_refund(p_refund_id := p_refund_id, p_reason := p_reason);
END;
$$;
ALTER FUNCTION public._srv_reject_refund(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_reject_refund(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_reject_refund(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._srv_reject_refund(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_reject_refund(uuid, uuid, text) TO service_role;

-- =============================================================================
-- 5. _srv_void_sales_order
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_void_sales_order(
  p_acting_user_id uuid,
  p_sales_order_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.void_sales_order(
    p_sales_order_id := p_sales_order_id,
    p_reason         := p_reason
  );
END;
$$;
ALTER FUNCTION public._srv_void_sales_order(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_void_sales_order(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_void_sales_order(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._srv_void_sales_order(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_void_sales_order(uuid, uuid, text) TO service_role;

-- =============================================================================
-- 6. _srv_gdpr_anonymize_customer
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_gdpr_anonymize_customer(
  p_acting_user_id uuid,
  p_customer_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.gdpr_anonymize_customer(
    p_customer_id := p_customer_id,
    p_reason      := p_reason
  );
END;
$$;
ALTER FUNCTION public._srv_gdpr_anonymize_customer(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_gdpr_anonymize_customer(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_gdpr_anonymize_customer(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._srv_gdpr_anonymize_customer(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_gdpr_anonymize_customer(uuid, uuid, text) TO service_role;

-- =============================================================================
-- 7. _srv_apply_installment_payment
-- =============================================================================
CREATE OR REPLACE FUNCTION public._srv_apply_installment_payment(
  p_acting_user_id uuid,
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_receipt_url text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_acting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_acting_user_id::text, 'role', 'authenticated')::text,
    true
  );
  SELECT public.apply_installment_payment(
    p_installment_id := p_installment_id,
    p_amount         := p_amount,
    p_payment_method := p_payment_method,
    p_receipt_url    := p_receipt_url,
    p_note           := p_note
  ) INTO v_result;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public._srv_apply_installment_payment(uuid, uuid, numeric, text, text, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public._srv_apply_installment_payment(uuid, uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._srv_apply_installment_payment(uuid, uuid, numeric, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public._srv_apply_installment_payment(uuid, uuid, numeric, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._srv_apply_installment_payment(uuid, uuid, numeric, text, text, text) TO service_role;

-- =============================================================================
-- REVOKE EXECUTE on the 7 original money-mover RPCs from `authenticated`.
-- Browser/client code (which authenticates as `authenticated` via the user
-- JWT) can no longer call these directly.
-- The `service_role` and `postgres` grants remain so the wrappers above and
-- any backend/admin tooling can still call them.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.record_manual_cash_movement(text, text, numeric, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_purchase_order(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_refund(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_refund(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.void_sales_order(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.gdpr_anonymize_customer(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_installment_payment(uuid, numeric, text, text, text) FROM authenticated;

COMMIT;
