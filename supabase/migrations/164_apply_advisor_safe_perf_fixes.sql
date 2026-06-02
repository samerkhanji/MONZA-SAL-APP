-- ============================================================================
-- Apply safe performance advisor fixes.
--
-- Source: Supabase performance advisor (run 2026-06-02).
-- Three categories of safe fixes:
--   1. auth_rls_initplan (3 policies on notification_preferences)
--      Replace bare auth.uid() with (SELECT auth.uid()) to avoid per-row
--      re-evaluation.
--   2. multiple_permissive_policies (17 tables)
--      Each has a permissive _sel (SELECT) policy AND a _write (FOR ALL)
--      policy. Because FOR ALL also covers SELECT, every SELECT runs both
--      quals. We narrow each _write policy to INSERT/UPDATE/DELETE so SELECT
--      sees only the _sel policy.
--   3. unindexed_foreign_keys (54)
--      CREATE INDEX IF NOT EXISTS on each FK column flagged by the advisor.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) auth_rls_initplan: notification_preferences
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notif_prefs_ins ON public.notification_preferences;
CREATE POLICY notif_prefs_ins ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notif_prefs_sel ON public.notification_preferences;
CREATE POLICY notif_prefs_sel ON public.notification_preferences
  FOR SELECT TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_owner());

DROP POLICY IF EXISTS notif_prefs_upd ON public.notification_preferences;
CREATE POLICY notif_prefs_upd ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) multiple_permissive_policies: split FOR ALL into INSERT/UPDATE/DELETE
--
-- Each block:
--   DROP the FOR ALL _write policy
--   CREATE three policies (INSERT, UPDATE, DELETE) with the same qual/check
-- The _sel SELECT policy is untouched, so SELECT now has only one
-- permissive policy.
-- ---------------------------------------------------------------------------

-- approval_thresholds (write qual: is_owner() OR has_capability('manage_team'))
DROP POLICY IF EXISTS approval_thresholds_write ON public.approval_thresholds;
CREATE POLICY approval_thresholds_ins ON public.approval_thresholds
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY approval_thresholds_upd ON public.approval_thresholds
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability))
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY approval_thresholds_del ON public.approval_thresholds
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability));

-- cash_drawers (write qual: is_owner())
DROP POLICY IF EXISTS cash_drawers_write ON public.cash_drawers;
CREATE POLICY cash_drawers_ins ON public.cash_drawers
  FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY cash_drawers_upd ON public.cash_drawers
  FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY cash_drawers_del ON public.cash_drawers
  FOR DELETE TO authenticated USING (is_owner());

-- cash_movements (write qual: is_owner())
DROP POLICY IF EXISTS cash_movements_owner_write ON public.cash_movements;
CREATE POLICY cash_movements_ins ON public.cash_movements
  FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY cash_movements_upd ON public.cash_movements
  FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY cash_movements_del ON public.cash_movements
  FOR DELETE TO authenticated USING (is_owner());

-- cash_sessions (write qual: is_owner())
DROP POLICY IF EXISTS cash_sessions_owner_write ON public.cash_sessions;
CREATE POLICY cash_sessions_ins ON public.cash_sessions
  FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY cash_sessions_upd ON public.cash_sessions
  FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY cash_sessions_del ON public.cash_sessions
  FOR DELETE TO authenticated USING (is_owner());

-- cash_settings (write qual: is_owner())
DROP POLICY IF EXISTS cash_settings_write ON public.cash_settings;
CREATE POLICY cash_settings_ins ON public.cash_settings
  FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY cash_settings_upd ON public.cash_settings
  FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY cash_settings_del ON public.cash_settings
  FOR DELETE TO authenticated USING (is_owner());

-- notification_event_rules
DROP POLICY IF EXISTS notif_event_rules_write ON public.notification_event_rules;
CREATE POLICY notif_event_rules_ins ON public.notification_event_rules
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY notif_event_rules_upd ON public.notification_event_rules
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability))
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY notif_event_rules_del ON public.notification_event_rules
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability));

-- purchase_orders
DROP POLICY IF EXISTS po_write ON public.purchase_orders;
CREATE POLICY po_ins ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('inventory'::user_capability));
CREATE POLICY po_upd ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('inventory'::user_capability))
  WITH CHECK (is_owner() OR has_capability('inventory'::user_capability));
CREATE POLICY po_del ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('inventory'::user_capability));

-- recall_vehicles
DROP POLICY IF EXISTS recall_vehicles_write ON public.recall_vehicles;
CREATE POLICY recall_vehicles_ins ON public.recall_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY recall_vehicles_upd ON public.recall_vehicles
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY recall_vehicles_del ON public.recall_vehicles
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability));

-- recalls
DROP POLICY IF EXISTS recalls_write ON public.recalls;
CREATE POLICY recalls_ins ON public.recalls
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY recalls_upd ON public.recalls
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY recalls_del ON public.recalls
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability));

-- service_intervals
DROP POLICY IF EXISTS service_intervals_write ON public.service_intervals;
CREATE POLICY service_intervals_ins ON public.service_intervals
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY service_intervals_upd ON public.service_intervals
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability))
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY service_intervals_del ON public.service_intervals
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability));

-- task_categories
DROP POLICY IF EXISTS task_categories_write ON public.task_categories;
CREATE POLICY task_categories_ins ON public.task_categories
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY task_categories_upd ON public.task_categories
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability))
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY task_categories_del ON public.task_categories
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability));

-- task_routing_rules
DROP POLICY IF EXISTS task_routing_write ON public.task_routing_rules;
CREATE POLICY task_routing_ins ON public.task_routing_rules
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY task_routing_upd ON public.task_routing_rules
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability))
  WITH CHECK (is_owner() OR has_capability('manage_team'::user_capability));
CREATE POLICY task_routing_del ON public.task_routing_rules
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('manage_team'::user_capability));

-- trade_in_documents
DROP POLICY IF EXISTS trade_in_documents_write ON public.trade_in_documents;
CREATE POLICY trade_in_documents_ins ON public.trade_in_documents
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));
CREATE POLICY trade_in_documents_upd ON public.trade_in_documents
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));
CREATE POLICY trade_in_documents_del ON public.trade_in_documents
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));

-- trade_in_issues
DROP POLICY IF EXISTS trade_in_issues_write ON public.trade_in_issues;
CREATE POLICY trade_in_issues_ins ON public.trade_in_issues
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));
CREATE POLICY trade_in_issues_upd ON public.trade_in_issues
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));
CREATE POLICY trade_in_issues_del ON public.trade_in_issues
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability) OR has_capability('sales'::user_capability));

-- warranty_case_documents
DROP POLICY IF EXISTS warranty_case_documents_write ON public.warranty_case_documents;
CREATE POLICY warranty_case_documents_ins ON public.warranty_case_documents
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_case_documents_upd ON public.warranty_case_documents
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_case_documents_del ON public.warranty_case_documents
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability));

-- warranty_case_parts
DROP POLICY IF EXISTS warranty_case_parts_write ON public.warranty_case_parts;
CREATE POLICY warranty_case_parts_ins ON public.warranty_case_parts
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_case_parts_upd ON public.warranty_case_parts
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_case_parts_del ON public.warranty_case_parts
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability));

-- warranty_cases
DROP POLICY IF EXISTS warranty_cases_write ON public.warranty_cases;
CREATE POLICY warranty_cases_ins ON public.warranty_cases
  FOR INSERT TO authenticated
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_cases_upd ON public.warranty_cases
  FOR UPDATE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability))
  WITH CHECK (is_owner() OR has_capability('garage'::user_capability));
CREATE POLICY warranty_cases_del ON public.warranty_cases
  FOR DELETE TO authenticated
  USING (is_owner() OR has_capability('garage'::user_capability));

-- ---------------------------------------------------------------------------
-- 3) unindexed_foreign_keys: covering indexes (54 total)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_car_arrival_checks_checked_by              ON public.car_arrival_checks (checked_by);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_by                  ON public.cash_movements (created_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_by                    ON public.cash_sessions (closed_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by                    ON public.cash_sessions (opened_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_reviewed_by                  ON public.cash_sessions (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_company_costs_approved_by                  ON public.company_costs (approved_by);
CREATE INDEX IF NOT EXISTS idx_company_costs_created_by                   ON public.company_costs (created_by);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_customer_id          ON public.company_costs (related_customer_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_employee_id          ON public.company_costs (related_employee_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_garage_job_id        ON public.company_costs (related_garage_job_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_purchase_order_id    ON public.company_costs (related_purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_sales_order_id       ON public.company_costs (related_sales_order_id);
CREATE INDEX IF NOT EXISTS idx_company_costs_related_supplier_id          ON public.company_costs (related_supplier_id);
CREATE INDEX IF NOT EXISTS idx_customers_anonymized_by                    ON public.customers (anonymized_by);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_by             ON public.marketing_campaigns (created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_related_car_id         ON public.marketing_campaigns (related_car_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_invoices_attached_by        ON public.purchase_order_invoices (attached_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_part_id               ON public.purchase_order_lines (part_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_payments_invoice_id         ON public.purchase_order_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_payments_paid_by            ON public.purchase_order_payments (paid_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_receipts_received_by        ON public.purchase_order_receipts (received_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_approved_by                ON public.purchase_orders (approved_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cancelled_by               ON public.purchase_orders (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by                 ON public.purchase_orders (created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_rejected_by                ON public.purchase_orders (rejected_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_related_car_id             ON public.purchase_orders (related_car_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requested_by               ON public.purchase_orders (requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sent_by                    ON public.purchase_orders (sent_by);
CREATE INDEX IF NOT EXISTS idx_recall_vehicles_completed_by               ON public.recall_vehicles (completed_by);
CREATE INDEX IF NOT EXISTS idx_recall_vehicles_job_id                     ON public.recall_vehicles (job_id);
CREATE INDEX IF NOT EXISTS idx_recalls_created_by                         ON public.recalls (created_by);
CREATE INDEX IF NOT EXISTS idx_refunds_approved_by                        ON public.refunds (approved_by);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice_id                         ON public.refunds (invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_paid_by                            ON public.refunds (paid_by);
CREATE INDEX IF NOT EXISTS idx_refunds_part_id                            ON public.refunds (part_id);
CREATE INDEX IF NOT EXISTS idx_refunds_rejected_by                        ON public.refunds (rejected_by);
CREATE INDEX IF NOT EXISTS idx_refunds_requested_by                       ON public.refunds (requested_by);
CREATE INDEX IF NOT EXISTS idx_sales_orders_void_by                       ON public.sales_orders (void_by);
CREATE INDEX IF NOT EXISTS idx_trade_in_documents_created_by              ON public.trade_in_documents (created_by);
CREATE INDEX IF NOT EXISTS idx_trade_in_issues_created_by                 ON public.trade_in_issues (created_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_approved_by                      ON public.trade_ins (approved_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_cancelled_by                     ON public.trade_ins (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_committed_by                     ON public.trade_ins (committed_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_created_by                       ON public.trade_ins (created_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_inspected_by                     ON public.trade_ins (inspected_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_inspection_started_by            ON public.trade_ins (inspection_started_by);
CREATE INDEX IF NOT EXISTS idx_trade_ins_rejected_by                      ON public.trade_ins (rejected_by);
CREATE INDEX IF NOT EXISTS idx_warranty_case_documents_created_by         ON public.warranty_case_documents (created_by);
CREATE INDEX IF NOT EXISTS idx_warranty_case_parts_created_by             ON public.warranty_case_parts (created_by);
CREATE INDEX IF NOT EXISTS idx_warranty_case_parts_part_id                ON public.warranty_case_parts (part_id);
CREATE INDEX IF NOT EXISTS idx_warranty_cases_closed_by                   ON public.warranty_cases (closed_by);
CREATE INDEX IF NOT EXISTS idx_warranty_cases_created_by                  ON public.warranty_cases (created_by);
CREATE INDEX IF NOT EXISTS idx_warranty_cases_opened_by                   ON public.warranty_cases (opened_by);
CREATE INDEX IF NOT EXISTS idx_warranty_cases_recall_id                   ON public.warranty_cases (recall_id);

COMMIT;
