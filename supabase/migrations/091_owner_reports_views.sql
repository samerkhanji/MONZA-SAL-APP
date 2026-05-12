-- Day 4 of the autopilot week: owner reports.
--
-- Five SECURITY-INVOKER views, all RLS-protected by the underlying tables
-- (cars, sales_orders, installment_payments, garage_jobs, profiles).
--
-- Owner / view_reports / manage_team can SELECT them. Each view leaves
-- bucketing + aggregation pre-computed so the FE can render with one query.

-- ============================================================================
-- 1) report_sales_margin
-- ============================================================================

CREATE OR REPLACE VIEW public.report_sales_margin AS
SELECT
  so.id                          AS sales_order_id,
  so.car_id,
  so.customer_id,
  so.created_by                  AS sales_rep_id,
  so.delivered_at,
  so.sale_date,
  so.selling_price               AS revenue,
  so.currency                    AS revenue_currency,
  c.price                        AS cost,
  c.price_currency               AS cost_currency,
  CASE
    WHEN so.currency = c.price_currency
     AND so.selling_price IS NOT NULL
     AND c.price IS NOT NULL
    THEN so.selling_price - c.price
    ELSE NULL
  END                            AS margin,
  CASE
    WHEN so.currency = c.price_currency
     AND so.selling_price IS NOT NULL
     AND c.price IS NOT NULL
     AND c.price > 0
    THEN ((so.selling_price - c.price) / c.price) * 100
    ELSE NULL
  END                            AS margin_pct,
  c.brand,
  c.model,
  c.model_year,
  c.vin
FROM public.sales_orders so
JOIN public.cars c ON c.id = so.car_id
WHERE so.status = 'delivered'::sale_status;

GRANT SELECT ON public.report_sales_margin TO authenticated;

-- ============================================================================
-- 2) report_sales_rep_performance
-- ============================================================================

CREATE OR REPLACE VIEW public.report_sales_rep_performance AS
SELECT
  p.id                                                             AS sales_rep_id,
  p.full_name                                                      AS sales_rep_name,
  count(*) FILTER (WHERE so.status NOT IN ('cancelled', 'delivered'))::int
                                                                   AS deals_in_pipeline,
  count(*) FILTER (WHERE so.status = 'delivered')::int              AS deals_delivered,
  count(*) FILTER (WHERE so.status = 'cancelled')::int              AS deals_voided,
  COALESCE(sum(so.selling_price)
    FILTER (WHERE so.status = 'delivered'), 0)                     AS revenue_total,
  COALESCE(sum(
    CASE
      WHEN so.status = 'delivered'
       AND so.currency = c.price_currency
       AND so.selling_price IS NOT NULL
       AND c.price IS NOT NULL
      THEN so.selling_price - c.price
      ELSE 0
    END
  ), 0)                                                            AS margin_total,
  AVG(
    CASE
      WHEN so.status = 'delivered'
       AND so.delivered_at IS NOT NULL
       AND so.created_at IS NOT NULL
      THEN extract(epoch FROM so.delivered_at - so.created_at) / 86400.0
      ELSE NULL
    END
  )                                                                AS avg_days_to_close
FROM public.profiles p
LEFT JOIN public.sales_orders so ON so.created_by = p.id
LEFT JOIN public.cars c          ON c.id = so.car_id
WHERE p.is_active = true
GROUP BY p.id, p.full_name;

GRANT SELECT ON public.report_sales_rep_performance TO authenticated;

-- ============================================================================
-- 3) report_inventory_aging
-- ============================================================================

CREATE OR REPLACE VIEW public.report_inventory_aging AS
SELECT
  c.id                                AS car_id,
  c.vin,
  c.brand,
  c.model,
  c.model_year,
  c.status,
  c.price,
  c.price_currency,
  COALESCE(c.date_bought, c.created_at::date) AS entry_date,
  GREATEST(
    0,
    (CURRENT_DATE - COALESCE(c.date_bought, c.created_at::date))
  )::int                              AS days_in_stock,
  CASE
    WHEN COALESCE(c.date_bought, c.created_at::date) IS NULL THEN 'unknown'
    WHEN CURRENT_DATE - COALESCE(c.date_bought, c.created_at::date) < 60  THEN '<60'
    WHEN CURRENT_DATE - COALESCE(c.date_bought, c.created_at::date) < 90  THEN '60-90'
    WHEN CURRENT_DATE - COALESCE(c.date_bought, c.created_at::date) < 180 THEN '90-180'
    ELSE '>180'
  END                                 AS age_bucket
FROM public.cars c
WHERE c.deleted_at IS NULL
  AND c.status NOT IN ('sold'::car_status, 'delivered'::car_status);

GRANT SELECT ON public.report_inventory_aging TO authenticated;

-- ============================================================================
-- 4) report_aged_receivables
-- ============================================================================

CREATE OR REPLACE VIEW public.report_aged_receivables AS
SELECT
  ip.id                                              AS installment_id,
  ip.plan_id,
  pp.customer_id,
  cust.first_name || COALESCE(' ' || cust.last_name, '') AS customer_name,
  cust.phone_primary                                 AS customer_phone,
  ip.installment_no,
  ip.due_date,
  ip.amount_due,
  COALESCE(ip.paid_amount, 0)                        AS paid_amount,
  GREATEST(ip.amount_due - COALESCE(ip.paid_amount, 0), 0) AS amount_outstanding,
  ip.status::text                                    AS status,
  GREATEST(0, (CURRENT_DATE - ip.due_date))::int     AS days_overdue,
  CASE
    WHEN CURRENT_DATE <= ip.due_date THEN 'current'
    WHEN CURRENT_DATE - ip.due_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - ip.due_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - ip.due_date <= 90 THEN '61-90'
    ELSE '>90'
  END                                                AS age_bucket
FROM public.installment_payments ip
JOIN public.payment_plans pp ON pp.id = ip.plan_id
LEFT JOIN public.customers cust ON cust.id = pp.customer_id
WHERE ip.status IN ('due', 'overdue', 'partial')
  AND pp.deleted_at IS NULL;

GRANT SELECT ON public.report_aged_receivables TO authenticated;

-- ============================================================================
-- 5) report_garage_time_in_state
-- ============================================================================

CREATE OR REPLACE VIEW public.report_garage_time_in_state AS
SELECT
  gj.id                              AS job_id,
  gj.title,
  gj.task_category_id,
  gj.created_at,
  gj.started_at,
  gj.completed_at,
  gj.delivered_at,
  CASE
    WHEN gj.started_at IS NOT NULL AND gj.created_at IS NOT NULL
    THEN extract(epoch FROM gj.started_at - gj.created_at) / 3600.0
  END                                AS queued_hours,
  CASE
    WHEN gj.completed_at IS NOT NULL AND gj.started_at IS NOT NULL
    THEN extract(epoch FROM gj.completed_at - gj.started_at) / 3600.0
  END                                AS active_hours,
  CASE
    WHEN gj.delivered_at IS NOT NULL AND gj.completed_at IS NOT NULL
    THEN extract(epoch FROM gj.delivered_at - gj.completed_at) / 3600.0
  END                                AS handover_hours,
  CASE
    WHEN gj.delivered_at IS NOT NULL AND gj.created_at IS NOT NULL
    THEN extract(epoch FROM gj.delivered_at - gj.created_at) / 3600.0
  END                                AS total_hours,
  CASE WHEN gj.task_category_id IS NOT NULL
       THEN (SELECT label_en FROM public.task_categories WHERE id = gj.task_category_id)
       ELSE NULL
  END                                AS category_label,
  c.brand,
  c.model,
  c.vin
FROM public.garage_jobs gj
LEFT JOIN public.cars c ON c.id = gj.car_id
WHERE gj.deleted_at IS NULL
  AND gj.status IN ('done', 'delivered');

GRANT SELECT ON public.report_garage_time_in_state TO authenticated;
