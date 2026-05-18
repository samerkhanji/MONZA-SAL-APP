-- ============================================================================
-- HOTFIX C-2: align warranty_notifications_sent.warranty_type CHECK with the
-- values the UI actually writes ('vehicle' and 'battery'), in addition to
-- the existing 'dms' and 'monza'. The pre-hotfix CHECK only allowed
-- ('dms','monza'); UI inserts of 'vehicle'/'battery' failed silently
-- because the client never inspected the .insert() error. This caused the
-- dedupe SELECT on the next session to find no row and the user was
-- re-notified daily.
--
-- Paired with a UI fix in web/src/components/WarrantyNotificationChecker.tsx
-- that adds error logging so future silent-insert failures cannot hide.
-- ============================================================================

ALTER TABLE public.warranty_notifications_sent
  DROP CONSTRAINT IF EXISTS warranty_notifications_sent_warranty_type_check;

ALTER TABLE public.warranty_notifications_sent
  ADD CONSTRAINT warranty_notifications_sent_warranty_type_check
  CHECK (warranty_type IN ('dms','monza','vehicle','battery'));
