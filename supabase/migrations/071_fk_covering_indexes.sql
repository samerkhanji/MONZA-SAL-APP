-- Add covering indexes on the 6 foreign-key columns flagged by the
-- performance advisor (lint 0001_unindexed_foreign_keys). Without these,
-- DELETE/UPDATE on the referenced tables (auth.users / profiles) trigger
-- sequential scans on the dependent tables.
--
-- Uses CREATE INDEX IF NOT EXISTS so the migration is idempotent.

CREATE INDEX IF NOT EXISTS idx_appointments_created_by           ON public.appointments (created_by);
CREATE INDEX IF NOT EXISTS idx_commissions_created_by            ON public.commissions (created_by);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created_by  ON public.customer_interactions (created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by               ON public.invoices (created_by);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_by              ON public.suppliers (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_user_id          ON public.tasks (created_by_user_id);
