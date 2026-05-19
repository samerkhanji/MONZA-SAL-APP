-- ============================================================================
-- HOTFIX C-9 follow-on: relax installment_no_positive to allow zero.
--
-- The pre-hotfix UI used installment_no=0 for the down-payment row by
-- convention. But the CHECK constraint required > 0, so even the OLD
-- direct-INSERT path was failing on every plan with a non-zero down
-- payment. The new create_payment_plan RPC inherits the same convention.
-- Relaxing to >= 0 keeps down-payment numbering distinct from monthly
-- (1..months) without inventing a separate column.
-- ============================================================================

ALTER TABLE public.installment_payments
  DROP CONSTRAINT IF EXISTS installment_no_positive;

ALTER TABLE public.installment_payments
  ADD CONSTRAINT installment_no_nonneg
  CHECK (installment_no >= 0);
