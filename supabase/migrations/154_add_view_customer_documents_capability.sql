-- ============================================
-- Monza S.A.L. — add view_customer_documents capability to user_capability enum
-- Migration 154
--
-- Customer documents (passport / ID scans, insurance certificates, contract
-- attachments) carry PII that should not be visible to every employee. This
-- migration adds an explicit capability that gates SELECT/INSERT/UPDATE on
-- customer_documents and the customer-documents storage bucket.
--
-- Migration 155 backfills owner profiles and replaces the policies; this
-- file only adds the enum value so the new value is committed before any
-- policy references it (a Postgres requirement — ADD VALUE cannot be used
-- in the same transaction it was added in).
-- ============================================

ALTER TYPE public.user_capability ADD VALUE IF NOT EXISTS 'view_customer_documents';
