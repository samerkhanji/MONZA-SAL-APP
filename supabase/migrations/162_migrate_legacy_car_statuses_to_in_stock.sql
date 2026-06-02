-- ============================================================================
-- Migrate legacy car statuses to 'in_stock'.
--
-- Live migration version: 20260526125700
-- Reconstructed for repo (this migration already exists on live DB).
--
-- Background: pre-launch the cars.status column used 'inventory' and
-- 'available'. The canonical post-launch value is 'in_stock'.
--
-- Note: live also has an intermediate migration version 20260526121200
-- (detect_warranty_expiry_add_dms) which was superseded by version
-- 20260526125825 (detect_warranty_expiry_helper_and_all_columns). The
-- superseded version is NOT reproduced in the repo; the final form is
-- captured in 163_detect_warranty_expiry_helper_and_all_columns.sql.
-- ============================================================================

UPDATE public.cars
SET status = 'in_stock'
WHERE status IN ('inventory', 'available');
