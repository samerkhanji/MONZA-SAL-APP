-- notification_event_rules: who gets pinged when which event fires.
-- Editable from Settings; rules below are the seed values matching the
-- owner spec matrix (1..11).

CREATE TABLE IF NOT EXISTS public.notification_event_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,
  description     text,
  category        public.notification_category NOT NULL,
  severity        public.notification_severity NOT NULL,
  recipient_kind  text NOT NULL CHECK (recipient_kind IN ('user','role','capability','event_subject_owner','event_submitter')),
  recipient_value text,
  channel_inapp   boolean NOT NULL DEFAULT true,
  channel_email   boolean NOT NULL DEFAULT false,
  channel_whatsapp boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_event_rules_event
  ON public.notification_event_rules(event_type) WHERE active = true;

ALTER TABLE public.notification_event_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_event_rules_sel ON public.notification_event_rules;
CREATE POLICY notif_event_rules_sel ON public.notification_event_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS notif_event_rules_write ON public.notification_event_rules;
CREATE POLICY notif_event_rules_write ON public.notification_event_rules
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('manage_team'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('manage_team'::user_capability));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_event_rules TO authenticated;

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity, recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('repair_proposal.stale_7d', 'Proposal waiting on customer > 7 days',
     'alert','warning','event_subject_owner', NULL, true, true, false, 'Service advisor on the job'),
  ('repair_proposal.stale_7d', 'Proposal waiting on customer > 7 days',
     'alert','warning','role','garage_manager', true, true, false, 'Garage manager'),
  ('repair_proposal.stale_14d','Proposal waiting on customer > 14 days (owner escalation)',
     'critical','urgent','role','owner', true, true, true, 'Owner WhatsApp at 14 days'),

  ('installment.underpayment', 'Partial payment received',
     'alert','urgent','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, true, false, 'Lara'),
  ('installment.underpayment', 'Partial payment received',
     'alert','urgent','user','f52a448a-2e19-4bec-be18-5f4e18176a3a', true, true, false, 'Samaya'),
  ('installment.underpayment', 'Partial payment received',
     'critical','urgent','role','owner', true, true, true, 'Owner WhatsApp — money issue'),

  ('installment.overpayment', 'Customer overpaid; credit issued',
     'alert','warning','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, true, false, 'Lara'),
  ('installment.overpayment', 'Customer overpaid; credit issued',
     'alert','warning','user','f52a448a-2e19-4bec-be18-5f4e18176a3a', true, true, false, 'Samaya'),
  ('installment.overpayment', 'Customer overpaid; credit issued',
     'alert','warning','role','owner', true, false, false, 'Owner in-app only'),

  ('installment.30d_late', 'Installment >30 days late',
     'critical','critical','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, true, false, 'Lara'),
  ('installment.30d_late', 'Installment >30 days late',
     'critical','critical','user','f52a448a-2e19-4bec-be18-5f4e18176a3a', true, true, false, 'Samaya'),
  ('installment.30d_late', 'Installment >30 days late',
     'critical','critical','role','owner', true, true, true, 'Owners + WhatsApp'),

  ('customer.created', 'New customer record',
     'customer','info','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, false, false, 'Lara data-quality check'),
  ('customer.created', 'New customer record',
     'customer','info','user','f52a448a-2e19-4bec-be18-5f4e18176a3a', true, false, false, 'Samaya data-quality check'),

  ('garage_job.stuck_7d', 'Job stuck without progress > 7 days',
     'alert','warning','role','garage_manager', true, true, false, 'Manager email at day 7'),
  ('garage_job.stuck_7d', 'Job stuck without progress > 7 days',
     'alert','warning','event_subject_owner', NULL, true, false, false, 'Service advisor on the job'),
  ('garage_job.stuck_14d','Job stuck > 14 days (owner escalation)',
     'critical','urgent','role','owner', true, true, true, 'Owner WhatsApp at 14 days'),

  ('parts.low_stock', 'Part below minimum',
     'alert','warning','user','14004842-32fc-417e-a0e4-8b482616857e', true, true, false, 'Mark — parts owner'),
  ('parts.low_stock', 'Part below minimum',
     'alert','warning','role','garage_manager', true, false, false, 'Manager in-app'),
  ('parts.low_stock_critical','Critical spare grounding a vehicle',
     'critical','urgent','role','owner', true, true, true, 'Owner WhatsApp for grounded vehicle'),

  ('test_drive.overdue_1h','Test drive overdue > 1 hour',
     'alert','warning','event_subject_owner', NULL, true, true, false, 'Sales advisor on the booking'),
  ('test_drive.overdue_1h','Test drive overdue > 1 hour',
     'alert','warning','capability','sales', true, true, false, 'Sales manager'),
  ('test_drive.overdue_3h','Test drive overdue > 3 hours — possible missing vehicle',
     'critical','critical','role','owner', true, true, true, 'Owner + WhatsApp'),

  ('warranty.expires_30d','Warranty expires in 30 days',
     'alert','info','event_subject_owner', NULL, true, false, false, 'Service advisor in-app only'),
  ('warranty.expires_14d','Warranty expires in 14 days',
     'alert','warning','event_subject_owner', NULL, true, true, false, 'Service advisor email reminder'),
  ('warranty.expires_14d','Warranty expires in 14 days',
     'alert','warning','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, false, false, 'Lara'),
  ('warranty.expires_7d', 'Warranty expires in 7 days',
     'alert','urgent','event_subject_owner', NULL, true, true, true, 'Advisor + WhatsApp'),
  ('warranty.expires_7d', 'Warranty expires in 7 days',
     'alert','urgent','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, true, false, 'Lara'),

  ('request.submitted', 'New internal request',
     'assignment','info','capability','manage_team', true, false, false, 'Department manager'),
  ('request.submitted', 'New internal request',
     'reply','info','event_submitter', NULL, true, false, false, 'Submitter sees their own confirmation'),
  ('request.sla_breach', 'Request past manager SLA',
     'approval','warning','role','owner', true, true, false, 'Owner only on escalation'),

  ('sale.voided', 'A sale was voided',
     'critical','critical','role','owner', true, true, true, 'Owners — always, with WhatsApp'),
  ('sale.voided', 'A sale was voided',
     'critical','critical','user','80829aa7-378a-4cd1-8d0b-debde9dc510d', true, true, false, 'Lara'),
  ('sale.voided', 'A sale was voided',
     'critical','critical','capability','sales', true, true, false, 'Sales manager + original rep')
ON CONFLICT DO NOTHING;
