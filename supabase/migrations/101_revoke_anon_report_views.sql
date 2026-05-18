-- ============================================================================
-- HOTFIX C-1: revoke anonymous (and PUBLIC) SELECT on the 8 report /
-- security-definer views that were leaking VINs, customer phones, margins,
-- employee names, and garage time data to anyone holding the public anon key.
--
-- Authenticated reads are preserved (the Reports page still works). A
-- follow-up integrity-sprint migration will switch these to
-- security_invoker + role-checked access; for the immediate leak, REVOKE
-- FROM anon is the minimum-blast-radius fix.
-- ============================================================================

REVOKE SELECT ON
  public.report_sales_margin,
  public.report_inventory_aging,
  public.report_sales_rep_performance,
  public.report_aged_receivables,
  public.report_garage_time_in_state,
  public.car_service_status,
  public.customer_credit_balance,
  public.garage_employee_efficiency
FROM anon;

REVOKE SELECT ON
  public.report_sales_margin,
  public.report_inventory_aging,
  public.report_sales_rep_performance,
  public.report_aged_receivables,
  public.report_garage_time_in_state,
  public.car_service_status,
  public.customer_credit_balance,
  public.garage_employee_efficiency
FROM PUBLIC;
