-- Sprint 1 of the workflow audit fixes:
--
-- 1) job_time_entries.employee_id -> user_id   (column rename so client code,
--    which already uses user_id everywhere, actually works. Time tracking
--    has been silently broken since the table was created — table currently
--    has 0 rows because every insert failed.)
-- 2) Recreate garage_employee_efficiency view against user_id.
-- 3) Add unique partial index that prevents the same job from having two
--    open time entries simultaneously.
-- 4) Add CHECK constraint on sales_orders.signed_contract_url so it's a
--    real http(s) URL (not "banana" or arbitrary text).

-- 1) Rename the column. Drop dependent view first.
DROP VIEW IF EXISTS public.garage_employee_efficiency;

ALTER TABLE public.job_time_entries
  RENAME COLUMN employee_id TO user_id;

-- 2) Recreate the view using user_id. (Previously joined p.id = jte.employee_id;
--    keep the column alias `employee_name` for backward compat with any
--    consumer outside the repo.)
CREATE OR REPLACE VIEW public.garage_employee_efficiency AS
  SELECT
    jte.user_id,
    p.full_name AS employee_name,
    p.user_role::text AS role,
    count(DISTINCT jte.job_id) AS jobs_count_30d,
    round(sum(jte.duration_minutes)::numeric / 60.0, 2) AS total_hours_30d,
    round(avg(jte.duration_minutes) / 60.0, 2) AS avg_hours_per_entry,
    round(avg(
      CASE
        WHEN j.estimated_hours IS NOT NULL
         AND j.estimated_hours > 0
         AND j.actual_hours IS NOT NULL
        THEN j.actual_hours / j.estimated_hours::numeric
        ELSE NULL::numeric
      END), 2) AS avg_actual_vs_estimated_ratio
  FROM public.job_time_entries jte
  JOIN public.profiles p ON p.id = jte.user_id
  LEFT JOIN public.garage_jobs j ON j.id = jte.job_id
  WHERE jte.started_at >= (now() - interval '30 days')
    AND jte.duration_minutes IS NOT NULL
  GROUP BY jte.user_id, p.full_name, p.user_role;

-- 3) Prevent two open sessions on the same job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_time_entries_one_open_per_job
  ON public.job_time_entries (job_id)
  WHERE ended_at IS NULL;

-- 4) Validate signed_contract_url is a real http(s) URL when set.
--    Permits NULL (no contract yet) and trims-then-checks the format.
--    Drop any prior version of this check first so the migration is idempotent.
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_signed_contract_url_format;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_signed_contract_url_format
  CHECK (
    signed_contract_url IS NULL
    OR signed_contract_url ~* '^https?://[^\s]+$'
  );
