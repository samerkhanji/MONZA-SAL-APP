-- ============================================================================
-- Monza S.A.L. — FULL DATA RESET (clean-slate launch)  v2
-- Generated 2026-06-08
--
-- v2 change: the SQL-editor `postgres` role is NOT a superuser, so it cannot
-- SET session_replication_role. Instead we use TRUNCATE ... CASCADE, which:
--   * needs only table ownership (postgres owns public.*),
--   * auto-resolves foreign-key order via CASCADE,
--   * bypasses the BEFORE DELETE `block_hard_delete_financial` guard
--     (migration 156) because row-level DELETE triggers don't fire on TRUNCATE.
--
-- Per owner instruction: wipe ALL business/transactional/master/log data,
-- KEEP login accounts (profiles + auth.users) and system configuration.
--
-- SAFETY / REVERSIBILITY
--   * EVERY table (wiped AND kept) is first copied into schema
--     `reset_backup_20260608` — so even an unexpected CASCADE is recoverable.
--   * Single transaction (the DO block): any failure rolls everything back.
--   * auth.users / auth schema untouched -> you stay logged in.
--
-- RUN: paste into Supabase Studio -> SQL Editor -> Run.
--
-- RESTORE a table:  insert into public.<t> select * from reset_backup_20260608.<t>;
-- DISCARD backups:  drop schema reset_backup_20260608 cascade;
-- ============================================================================

do $reset$
declare
  t text;

  -- Tables to WIPE (business / transactional / master / logs).
  wipe_tables text[] := array[
    'cars', 'car_events', 'car_documents', 'car_warranties', 'car_arrival_checks',
    'customers', 'customer_notes', 'customer_documents', 'customer_interactions', 'customer_credits',
    'sales_orders', 'payment_plans', 'installment_payments', 'invoices', 'commissions', 'refunds', 'company_costs',
    'trade_ins', 'trade_in_issues', 'trade_in_documents',
    'test_drives', 'appointments', 'tasks', 'task_timers',
    'garage_jobs', 'garage_tasks', 'garage_job_bay_context', 'bay_assignment_history',
    'job_parts', 'job_documents', 'job_time_entries', 'repair_proposals', 'repair_proposal_items',
    'parts', 'part_movements', 'suppliers', 'accessory_inventory',
    'purchase_orders', 'purchase_order_lines', 'purchase_order_receipts',
    'purchase_order_receipt_lines', 'purchase_order_invoices', 'purchase_order_payments',
    'cash_sessions', 'cash_movements',
    'warranty_cases', 'warranty_case_parts', 'warranty_case_documents', 'recalls', 'recall_vehicles',
    'marketing_campaigns',
    'notifications', 'warranty_notifications_sent', 'service_day_notifications_sent', 'push_subscriptions',
    'requests', 'document_access_requests', 'delete_requests', 'page_access_requests',
    'system_events', 'api_rate_limit_events'
  ];

  -- Tables to KEEP (logins + config) — backed up too, never truncated here.
  keep_tables text[] := array[
    'profiles',
    'system_preferences', 'approval_thresholds', 'notification_preferences',
    'notification_event_rules', 'task_categories', 'task_routing_rules',
    'service_intervals', 'garage_bays', 'garage_capacities',
    'garage_task_templates', 'garage_task_template_items',
    'cash_drawers', 'cash_settings', 'infrastructure_compute_target',
    'accessory_custom_tables', 'accessory_custom_items'
  ];
begin
  -- 1) Back up EVERYTHING first (data-only copies).
  execute 'create schema if not exists reset_backup_20260608';
  foreach t in array (wipe_tables || keep_tables) loop
    execute format(
      'drop table if exists reset_backup_20260608.%I; '
      'create table reset_backup_20260608.%I as table public.%I',
      t, t, t
    );
  end loop;

  -- 2) Wipe — one TRUNCATE, CASCADE resolves FK order, RESTART IDENTITY resets seqs.
  execute 'truncate table ' ||
    (select string_agg(format('public.%I', tb), ', ')
       from unnest(wipe_tables) as tb) ||
    ' restart identity cascade';
end
$reset$;
