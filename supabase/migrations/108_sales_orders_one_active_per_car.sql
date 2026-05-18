-- ============================================================================
-- HOTFIX C-10: enforce one active sales_order per car.
--
-- Pre-hotfix: two sales staff could each open the customer flow on the
-- same VIN at the same time and both succeed in writing a `reserved` /
-- `draft` / `confirmed` sales_order. The car-status sync trigger then
-- clobbered and the dealership ended up with one VIN promised to two
-- different customers.
--
-- "Active" = status NOT IN ('cancelled','delivered'). A voided sale stays
-- visible with status='cancelled' (and void_at set), so a new reservation
-- can be opened against the same VIN after a void.
--
-- Verified active-duplicate count at apply time: 0.
-- Smoke-tested end-to-end: second active sale rejected by unique_violation;
-- new sale allowed after first was cancelled.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_orders_one_active_per_car
  ON public.sales_orders (car_id)
  WHERE status NOT IN ('cancelled','delivered') AND car_id IS NOT NULL;
