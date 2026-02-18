-- ============================================
-- MONZA CRM - Request Center RLS Policy Fixes
-- Migration 003: Tighten overly permissive policies
-- ============================================

-- 1. request_attachments: users can only attach files to their own requests
DROP POLICY IF EXISTS "request_attachments_insert" ON "public"."request_attachments";

CREATE POLICY "request_attachments_insert" ON "public"."request_attachments"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = request_attachments.request_id
      AND requests.submitted_by = auth.uid()
    )
  );

-- 2. requests: users can only update requests they submitted, are assigned to, or are owner
DROP POLICY IF EXISTS "requests_update" ON "public"."requests";

CREATE POLICY "requests_update" ON "public"."requests"
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
  );

-- 3. request_notifications: users can only insert notifications for requests they're involved in
DROP POLICY IF EXISTS "request_notifications_insert" ON "public"."request_notifications";

CREATE POLICY "request_notifications_insert" ON "public"."request_notifications"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = request_notifications.request_id
      AND (requests.submitted_by = auth.uid() OR requests.assigned_to = auth.uid())
    )
  );
