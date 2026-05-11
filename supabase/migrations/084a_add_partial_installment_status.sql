-- Wave 12 (a): add 'partial' to installment_status enum.
--
-- Must be its own migration: ALTER TYPE ... ADD VALUE cannot be used in the
-- same transaction as queries that reference the new value. The policy logic
-- itself lives in 084b.

ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'partial' BEFORE 'paid';
