-- ============================================================================
-- Monza S.A.L. — FULL DATA RESET (clean-slate launch)
-- Generated 2026-06-08
--
-- Per owner instruction ("we can erase all the data and start again ... none
-- of it is 100% true"): wipe ALL business / transactional / master test data,
-- KEEP login accounts (profiles + auth.users) and KEEP system configuration
-- (preferences, thresholds, notification/task rules, garage bays & templates,
-- cash drawer/settings, service intervals).
--
-- SAFETY / REVERSIBILITY
--   * Every wiped table is first copied verbatim into schema
--     `reset_backup_20260608` (CREATE TABLE ... AS TABLE ...). Data only — no
--     constraints/indexes — which is all you need to restore rows.
--   * The whole thing runs in ONE transaction (the DO block). If any single
--     statement fails, EVERYTHING rolls back — no partial wipe.
--   * Inside the wipe we set `session_replication_role = replica` (LOCAL to the
--     transaction, auto-reverts on COMMIT). That bypasses:
--        - foreign-key enforcement  -> deletes can run in any order
--        - user triggers, incl. `block_hard_delete_financial_tables`
--   * auth.users and the `auth` schema are NOT touched -> you stay logged in.
--
-- HOW TO RUN
--   Paste this whole file into Supabase Studio -> SQL Editor -> Run.
--   (Requires the default `postgres` role, which the SQL editor uses.)
--
-- TO RESTORE (if you change your mind, before you drop the backup schema):
--   begin;
--   set local session_replication_role = replica;
--   insert into public.cars      select * from reset_backup_20260608.cars;
--   insert into public.customers  select * from reset_backup_20260608.customers;
--   ... (repeat for each table) ...
--   set local session_replication_role = origin;
--   commit;
--
-- TO DISCARD the safety copies once you're happy:
--   drop schema reset_backup_20260608 cascade;
-- ============================================================================

do $reset$
declare
  t          text;
  -- ----------------------------------------------------------------------
  -- WIPE LIST — every business/transactional/master + log table.
  -- Anything NOT in this list is KEPT (see the KEEP manifest comment below).
  -- ----------------------------------------------------------------------
  wipe_tables text[] := array[
    -- cars & related
    'cars', 'car_events', 'car_documents', 'car_warranties',
    'car_arrival_checks',
    -- customers & related
    'customers', 'customer_notes', 'customer_documents',
    'customer_interactions', 'customer_credits',
    -- sales / finance
    'sales_orders', 'payment_plans', 'installment_payments',
    'invoices', 'commissions', 'refunds', 'company_costs',
    -- trade-ins
    'trade_ins', 'trade_in_issues', 'trade_in_documents',
    -- test drives & appointments & tasks
    'test_drives', 'appointments', 'tasks', 'task_timers',
    -- garage / jobs
    'garage_jobs', 'garage_tasks', 'garage_job_bay_context',
    'bay_assignment_history', 'job_parts', 'job_documents',
    'job_time_entries', 'repair_proposals', 'repair_proposal_items',
    -- parts / suppliers / accessories inventory
    'parts', 'part_movements', 'suppliers', 'accessory_inventory',
    -- purchase orders
    'purchase_orders', 'purchase_order_lines', 'purchase_order_receipts',
    'purchase_order_receipt_lines', 'purchase_order_invoices',
    'purchase_order_payments',
    -- cash (sessions/movements only; drawer & settings are config -> kept)
    'cash_sessions', 'cash_movements',
    -- warranty cases & recalls
    'warranty_cases', 'warranty_case_parts', 'warranty_case_documents',
    'recalls', 'recall_vehicles',
    -- marketing
    'marketing_campaigns',
    -- notifications & request/approval workflow rows
    'notifications', 'warranty_notifications_sent',
    'service_day_notifications_sent', 'push_subscriptions',
    'requests', 'document_access_requests', 'delete_requests',
    'page_access_requests',
    -- logs / audit
    'system_events', 'api_rate_limit_events'
  ];
begin
  -- 1) BACKUP every target table into a dated schema (data-only copies).
  execute 'create schema if not exists reset_backup_20260608';
  foreach t in array wipe_tables loop
    execute format(
      'drop table if exists reset_backup_20260608.%I; '
      'create table reset_backup_20260608.%I as table public.%I',
      t, t, t
    );
  end loop;

  -- 2) Disable FK enforcement + user triggers for this transaction only.
  perform set_config('session_replication_role', 'replica', true);

  -- 3) Wipe. Order-independent thanks to replica mode.
  foreach t in array wipe_tables loop
    execute format('delete from public.%I', t);
  end loop;

  -- 4) Restore normal behaviour (also auto-reverts on COMMIT since LOCAL).
  perform set_config('session_replication_role', 'origin', true);
end
$reset$;

-- ============================================================================
-- KEPT (NOT wiped) — verify this is what you want before running:
--
--   LOGIN / IDENTITY
--     profiles                         (auth.users untouched too)
--
--   SYSTEM CONFIGURATION / SEED
--     system_preferences
--     approval_thresholds
--     notification_preferences
--     notification_event_rules
--     task_categories
--     task_routing_rules
--     service_intervals
--     garage_bays
--     garage_capacities
--     garage_task_templates
--     garage_task_template_items
--     cash_drawers
--     cash_settings
--     infrastructure_compute_target
--     accessory_custom_tables          (custom-table definitions; currently empty)
--     accessory_custom_items           (currently empty)
--
-- If you want any KEPT table wiped, add its name to wipe_tables[].
-- If you want any WIPED table kept, remove it from wipe_tables[].
-- ============================================================================
