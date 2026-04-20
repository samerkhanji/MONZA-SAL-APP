-- Migration 051: Security RLS Hardening
-- Tightens overly-permissive policies on cars, sales_orders,
-- notifications, and request_attachments identified in security audit.

-- ─────────────────────────────────────────────
-- 1. CARS – restrict UPDATE to management roles
--    SELECT stays open to all authenticated (staff need inventory visibility).
--    INSERT stays open to authenticated (owners/assistants add cars).
--    UPDATE restricted: garage_staff cannot modify car records.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can update cars" ON public.cars;

CREATE POLICY "cars_update_management_roles"
  ON public.cars FOR UPDATE
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]
    )
  )
  WITH CHECK (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops','garage_manager']::public.user_role[]
    )
  );

-- ─────────────────────────────────────────────
-- 2. SALES_ORDERS – restrict SELECT to sales roles
--    Garage staff should not see pricing or customer sale records.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sales_orders_select_authenticated" ON public.sales_orders;

CREATE POLICY "sales_orders_select_sales_roles"
  ON public.sales_orders FOR SELECT
  TO authenticated
  USING (
    public.is_any_role_resolved(
      ARRAY['owner','assistant','sales_ops']::public.user_role[]
    )
  );

-- ─────────────────────────────────────────────
-- 3. NOTIFICATIONS – restrict INSERT to own user_id
--    Server-side service-role inserts bypass RLS (correct behaviour).
--    Prevents an authenticated user from inserting notifications for others.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "notifications_insert_own"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 4. REQUEST_ATTACHMENTS – restrict INSERT to uploader = caller
--    Prevents staff from attaching files under another user's identity.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "request_attachments_insert" ON public.request_attachments;

CREATE POLICY "request_attachments_insert_own"
  ON public.request_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
