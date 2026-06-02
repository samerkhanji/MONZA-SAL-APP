-- ============================================================================
-- Enable is_pipeline_user = true for remaining employees.
--
-- Live migration version: 20260526101310
-- Reconstructed for repo (this migration already exists on live DB).
--
-- Targets: lara, samaya, suhail.
-- ============================================================================

UPDATE public.profiles
SET is_pipeline_user = true
WHERE id IN (
  '80829aa7-378a-4cd1-8d0b-debde9dc510d', -- lara
  'f52a448a-2e19-4bec-be18-5f4e18176a3a', -- samaya
  '88e7960c-911f-49c2-9db1-082b86b35f7d'  -- suhail
);
