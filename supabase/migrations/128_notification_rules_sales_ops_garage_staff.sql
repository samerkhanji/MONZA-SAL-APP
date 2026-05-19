-- 128_notification_rules_sales_ops_garage_staff.sql
-- Adds notification recipient rules for the new role/capability targets
-- introduced in the role/permissions hotfix:
--   * sales_ops role
--   * garage_staff role
--   * cashier capability (cash variance specifically)
--
-- Safe to re-run: every INSERT uses ON CONFLICT DO NOTHING so we never
-- duplicate. If any of these event_type values isn't emitted yet, the row
-- simply sits dormant until an emitter is wired.

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value,
   channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  -- ----- sales_ops -----
  ('customer.created',
     'New customer record',
     'customer', 'info',
     'role', 'sales_ops',
     true, false, false,
     'Sales ops sees new customers for data-quality check'),

  ('test_drive.overdue_1h',
     'Test drive overdue > 1 hour',
     'alert', 'warning',
     'role', 'sales_ops',
     true, false, false,
     'Sales ops watches overdue test drives'),

  ('sale.voided',
     'A sale was voided',
     'critical', 'critical',
     'role', 'sales_ops',
     true, false, false,
     'Sales ops sees voided sales'),

  ('trade_in.approved',
     'Trade-in approved',
     'status_change', 'warning',
     'role', 'sales_ops',
     true, false, false,
     'Sales ops mirror of the submitter ping'),

  ('trade_in.rejected',
     'Trade-in rejected',
     'status_change', 'warning',
     'role', 'sales_ops',
     true, false, false,
     'Sales ops mirror of the submitter ping'),

  -- ----- garage_staff -----
  ('task.assigned',
     'You have a new task',
     'assignment', 'warning',
     'role', 'garage_staff',
     true, false, false,
     'Garage staff pool sees task fan-outs'),

  ('garage_job.parts_arrived',
     'Parts arrived for a garage job',
     'alert', 'info',
     'role', 'garage_staff',
     true, false, false,
     'Garage staff alerted when parts are in'),

  ('service.due_soon',
     'Service is coming due soon',
     'alert', 'info',
     'role', 'garage_staff',
     true, false, false,
     'Garage staff sees upcoming services'),

  -- ----- cashier capability -----
  ('cash.variance_over_threshold',
     'Cash session closed with variance over threshold',
     'critical', 'urgent',
     'capability', 'cashier',
     true, false, false,
     'Cashier hears about their own session variance')
ON CONFLICT DO NOTHING;
