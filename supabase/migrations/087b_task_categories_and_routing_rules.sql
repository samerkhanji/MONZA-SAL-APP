-- The 13 reason categories from the owner spec, plus the routing rules
-- that say "this category auto-creates a task to this person/role."
-- Editable from Settings later; seed values match the spec verbatim.

CREATE TABLE IF NOT EXISTS public.task_categories (
  id                        text PRIMARY KEY,
  label_en                  text NOT NULL,
  label_ar                  text,
  description               text,
  sla_hours                 integer NOT NULL,
  escalate_after_extra_hours integer NOT NULL DEFAULT 24,
  requires_triage_first     boolean NOT NULL DEFAULT false,
  default_severity          public.notification_severity NOT NULL DEFAULT 'info',
  active                    boolean NOT NULL DEFAULT true,
  sort_order                integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_categories_sel ON public.task_categories;
CREATE POLICY task_categories_sel ON public.task_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS task_categories_write ON public.task_categories;
CREATE POLICY task_categories_write ON public.task_categories
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('manage_team'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('manage_team'::user_capability));

GRANT SELECT ON public.task_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_categories TO authenticated;

INSERT INTO public.task_categories
  (id, label_en, description, sla_hours, escalate_after_extra_hours, requires_triage_first, default_severity, sort_order)
VALUES
  ('software_update',     'Software / OTA update',
     'Firmware version logged before and after. Mark owns end-to-end.',
     48, 24, false, 'warning', 10),
  ('scheduled_service',   'Scheduled service (km-based)',
     'Oil change, cabin filter, brake fluid, etc. Any certed tech can grab.',
     8,  16, false, 'info', 20),
  ('customer_complaint',  'Customer complaint / fault diagnostic',
     'Senior tech triages first; reroutes to the right specialty.',
     24, 24, true,  'urgent', 30),
  ('body_paint',          'Body / paint / collision',
     'Body shop lead. Auto-flag for insurance check.',
     120, 48, false, 'warning', 40),
  ('warranty_claim',      'Warranty claim work',
     'Tech + Lara starts DMS prep in parallel.',
     72, 24, false, 'warning', 50),
  ('recall_campaign',     'Recall / safety campaign',
     'Assigned tech + Lara reports completion to Dongfeng.',
     72, 24, false, 'urgent', 60),
  ('accessory_install',   'Accessory install',
     'Parts owner confirms stock; on out-of-stock, becomes parts-order + install.',
     72, 24, false, 'info', 70),
  ('parts_request',       'Parts request / restock (sub-task)',
     'Sub-task of an existing job; otherwise treat like accessory install.',
     24, 24, false, 'warning', 80),
  ('pdi',                 'PDI (new vehicle arrival)',
     'PDI tech with brand-specific checklist + Samaya for AIA/customs paperwork.',
     120, 48, false, 'info', 90),
  ('delivery_prep',       'Delivery prep',
     'Wash → polish → final QC → Samaya pings customer for handover slot.',
     48, 24, false, 'warning', 100),
  ('hybrid_combo',        'Service + finance combo',
     'Tech + Lara/Samaya; both halves must close before the job does.',
     48, 24, false, 'urgent', 110),
  ('trade_in_inspection', 'Trade-in / pre-owned inspection',
     'Senior tech full 30-point inspection; output to pre-owned valuation.',
     24, 24, false, 'info', 120),
  ('internal_staff',      'Internal / staff vehicle',
     'Lowest priority; scheduled in gap time. Tagged separately for metrics.',
     168, 72, false, 'info', 130)
ON CONFLICT (id) DO UPDATE SET
  label_en = EXCLUDED.label_en,
  description = EXCLUDED.description,
  sla_hours = EXCLUDED.sla_hours,
  escalate_after_extra_hours = EXCLUDED.escalate_after_extra_hours,
  requires_triage_first = EXCLUDED.requires_triage_first,
  default_severity = EXCLUDED.default_severity,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.task_routing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     text NOT NULL REFERENCES public.task_categories(id) ON DELETE CASCADE,
  assignee_kind   text NOT NULL CHECK (assignee_kind IN ('user','role','capability')),
  assignee_value  text NOT NULL,
  is_primary      boolean NOT NULL DEFAULT true,
  is_parallel     boolean NOT NULL DEFAULT false,
  role_label      text,
  note            text,
  active          boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_routing_rules_category
  ON public.task_routing_rules(category_id);

ALTER TABLE public.task_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_routing_sel ON public.task_routing_rules;
CREATE POLICY task_routing_sel ON public.task_routing_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS task_routing_write ON public.task_routing_rules;
CREATE POLICY task_routing_write ON public.task_routing_rules
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('manage_team'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('manage_team'::user_capability));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_routing_rules TO authenticated;

INSERT INTO public.task_routing_rules
  (category_id, assignee_kind, assignee_value, is_primary, is_parallel, role_label, note, sort_order)
VALUES
  ('software_update', 'user', '14004842-32fc-417e-a0e4-8b482616857e', true,  false, 'Owner: Mark',          'Logs versions before/after', 10),

  ('scheduled_service', 'role', 'garage_staff',                       true,  false, 'Any garage staff',     'First to claim owns it',     10),
  ('scheduled_service', 'role', 'garage_manager',                     false, false, 'Manager visibility',   'Manager sees the queue',     20),

  ('customer_complaint', 'user', '14004842-32fc-417e-a0e4-8b482616857e', true, false, 'Triage: Mark',       'Decides specialty before bay',10),

  ('body_paint', 'role', 'garage_manager', true,  false, 'Body shop lead (manager for now)', 'Reassign when body lead profile exists', 10),
  ('body_paint', 'user', 'f52a448a-2e19-4bec-be18-5f4e18176a3a', false, true,  'Samaya — insurance check', 'Insurance/claim paperwork',                10),

  ('warranty_claim', 'role', 'garage_staff', true,  false, 'Assigned tech',           'Tech does the work',           10),
  ('warranty_claim', 'user', '80829aa7-378a-4cd1-8d0b-debde9dc510d', false, true,  'Lara — warranty paperwork','Starts DMS submission in parallel',10),

  ('recall_campaign', 'role', 'garage_staff', true,  false, 'Assigned tech',           'Work',                          10),
  ('recall_campaign', 'user', '80829aa7-378a-4cd1-8d0b-debde9dc510d', false, true,  'Lara — Dongfeng reporting','Recall completion reporting',  10),

  ('accessory_install', 'user', '14004842-32fc-417e-a0e4-8b482616857e', true,  false, 'Accessories owner (Mark)', 'Confirms stock or triggers order', 10),
  ('accessory_install', 'role', 'garage_staff',                       false, true,  'Install tech',             'After parts confirmed',            20),

  ('parts_request', 'user', '14004842-32fc-417e-a0e4-8b482616857e', true, false, 'Parts owner (Mark)', 'Treated as accessory install if customer-facing', 10),

  ('pdi', 'role', 'garage_staff', true,  false, 'PDI tech',                 'Brand-specific checklist', 10),
  ('pdi', 'user', 'f52a448a-2e19-4bec-be18-5f4e18176a3a', false, true,  'Samaya — AIA/customs',     'Paperwork race in parallel', 20),

  ('delivery_prep', 'role', 'garage_staff', true,  false, 'Garage staff', 'Wash → polish → QC', 10),
  ('delivery_prep', 'user', 'f52a448a-2e19-4bec-be18-5f4e18176a3a', false, true,  'Samaya — handover', 'Pings customer for slot', 20),

  ('hybrid_combo', 'role', 'garage_staff', true,  false, 'Garage tech', 'Service half',                    10),
  ('hybrid_combo', 'user', 'f52a448a-2e19-4bec-be18-5f4e18176a3a', false, true,  'Samaya — installments',    'Finance half; both must close', 20),
  ('hybrid_combo', 'user', '80829aa7-378a-4cd1-8d0b-debde9dc510d', false, true,  'Lara — installments',      'Co-handles installment side',   30),

  ('trade_in_inspection', 'user', '14004842-32fc-417e-a0e4-8b482616857e', true, false, 'Senior tech (Mark)', '30-point inspection', 10),

  ('internal_staff', 'role', 'garage_manager', true, false, 'Garage manager schedules', 'Lowest priority; tagged for metrics', 10)
ON CONFLICT DO NOTHING;
