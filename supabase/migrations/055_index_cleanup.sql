-- Migration 055: index hygiene.
--
-- 1. Add the 2 missing FK-covering indexes flagged by the unindexed_foreign_keys advisor.
-- 2. Drop the 34 unused indexes flagged by unused_index. These were never picked up by
--    the planner since their creation; each one slows down writes and consumes pages.
--
-- Safe to revert: the dropped indexes can be re-created from migrations.

-- Missing FK indexes
CREATE INDEX IF NOT EXISTS idx_bay_assignment_history_created_by
  ON public.bay_assignment_history (created_by);

CREATE INDEX IF NOT EXISTS idx_requests_send_to_user_id
  ON public.requests (send_to_user_id);

-- Unused indexes — drop in batches by table for readability.

-- system_events
DROP INDEX IF EXISTS public.system_events_created_idx;
DROP INDEX IF EXISTS public.system_events_type_idx;

-- car_events
DROP INDEX IF EXISTS public.idx_car_events_car_id;
DROP INDEX IF EXISTS public.car_events_event_group_id_idx;
DROP INDEX IF EXISTS public.car_events_event_type_idx;

-- task_timers
DROP INDEX IF EXISTS public.task_timers_task_idx;

-- cars
DROP INDEX IF EXISTS public.idx_cars_date_arrived;
DROP INDEX IF EXISTS public.cars_plate_number_idx;

-- garage_jobs
DROP INDEX IF EXISTS public.idx_garage_jobs_one_active_per_bay;
DROP INDEX IF EXISTS public.idx_garage_jobs_customer_id;

-- system_preferences
DROP INDEX IF EXISTS public.idx_system_preferences_updated_by;

-- accessory_custom_items
DROP INDEX IF EXISTS public.accessory_custom_items_table_idx;

-- car_documents
DROP INDEX IF EXISTS public.idx_car_documents_car_id;

-- parts
DROP INDEX IF EXISTS public.idx_parts_oe_number;
DROP INDEX IF EXISTS public.idx_parts_status;
DROP INDEX IF EXISTS public.idx_parts_car_model;
DROP INDEX IF EXISTS public.idx_parts_supplier;

-- payment_plans
DROP INDEX IF EXISTS public.idx_payment_plans_car_id;
DROP INDEX IF EXISTS public.idx_payment_plans_customer_id;

-- repair_proposals*
DROP INDEX IF EXISTS public.idx_proposal_items_proposal_id;
DROP INDEX IF EXISTS public.idx_repair_proposals_car_id;
DROP INDEX IF EXISTS public.idx_repair_proposals_customer_id;

-- test_drives
DROP INDEX IF EXISTS public.idx_test_drives_customer_id;
DROP INDEX IF EXISTS public.idx_test_drives_test_drive_start_at;
DROP INDEX IF EXISTS public.idx_test_drives_start_at;
DROP INDEX IF EXISTS public.idx_test_drives_vin;

-- installment_payments
DROP INDEX IF EXISTS public.idx_installment_payments_plan_id_fk;

-- push_subscriptions
DROP INDEX IF EXISTS public.idx_push_subscriptions_user_id_fk;

-- warranty/service notifications
DROP INDEX IF EXISTS public.idx_warranty_notifications_sent_car_id_fk;
DROP INDEX IF EXISTS public.idx_service_day_notifications_sent_job_id_fk;

-- notifications
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_notifications_created_at;

-- garage_bays
DROP INDEX IF EXISTS public.idx_garage_bays_current_job_id_fk;

-- requests
DROP INDEX IF EXISTS public.idx_requests_vin;
DROP INDEX IF EXISTS public.idx_requests_owner_visible;
DROP INDEX IF EXISTS public.idx_requests_department_id;
DROP INDEX IF EXISTS public.idx_requests_pipeline_enabled;

-- bay_assignment_history (the original audit-log indexes; the new FK index above is what we keep)
DROP INDEX IF EXISTS public.idx_bah_bay;
DROP INDEX IF EXISTS public.idx_bah_car;

-- garage_tasks*
DROP INDEX IF EXISTS public.idx_garage_tasks_car_id;
DROP INDEX IF EXISTS public.idx_garage_tasks_assigned_to;
DROP INDEX IF EXISTS public.idx_garage_tasks_created_by;
DROP INDEX IF EXISTS public.idx_garage_tasks_template_item_id;
DROP INDEX IF EXISTS public.idx_garage_task_template_items_tid;
DROP INDEX IF EXISTS public.idx_garage_task_templates_created_by;

-- garage_capacities
DROP INDEX IF EXISTS public.idx_garage_capacities_updated_by;

-- infrastructure_compute_target
DROP INDEX IF EXISTS public.idx_icg_updated_by;

-- profiles
DROP INDEX IF EXISTS public.idx_profiles_is_pipeline_user;
DROP INDEX IF EXISTS public.idx_profiles_can_view_owner_requests;
