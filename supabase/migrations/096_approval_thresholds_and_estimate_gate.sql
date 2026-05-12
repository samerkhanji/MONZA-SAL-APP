-- Phase B2+B6: estimate-approval gate + goodwill threshold table.
--
-- One generic approval_thresholds table holds the limits, owner-editable
-- via RLS. A required_approver() RPC returns 'auto' | 'manager' | 'owner'
-- so the UI can decide which gate to apply without hard-coding numbers.
--
-- repair_proposals.status CHECK is widened to accept the new
-- 'pending_owner_approval' state for the high-value estimate gate.

CREATE TABLE IF NOT EXISTS public.approval_thresholds (
  id              text PRIMARY KEY,
  label_en        text NOT NULL,
  description     text,
  currency        text NOT NULL DEFAULT 'USD',
  manager_floor   numeric NOT NULL DEFAULT 0,
  owner_floor     numeric NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_thresholds_floors_ordered
    CHECK (owner_floor >= manager_floor)
);

ALTER TABLE public.approval_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_thresholds_sel ON public.approval_thresholds;
CREATE POLICY approval_thresholds_sel ON public.approval_thresholds
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS approval_thresholds_write ON public.approval_thresholds;
CREATE POLICY approval_thresholds_write ON public.approval_thresholds
  FOR ALL TO authenticated
  USING (public.is_owner() OR public.has_capability('manage_team'::user_capability))
  WITH CHECK (public.is_owner() OR public.has_capability('manage_team'::user_capability));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_thresholds TO authenticated;

INSERT INTO public.approval_thresholds
  (id, label_en, description, currency, manager_floor, owner_floor)
VALUES
  ('estimate',
     'Repair estimate',
     'Estimates >= manager_floor need manager sign-off; >= owner_floor need owner.',
     'USD', 300, 2000),
  ('goodwill',
     'Goodwill discount',
     'Goodwill given to a customer. Manager up to owner_floor; owner above.',
     'USD', 0, 300),
  ('parts_order',
     'Parts order (supplier)',
     'Single parts order amount. Manager places below owner_floor; owner above.',
     'USD', 0, 1000)
ON CONFLICT (id) DO UPDATE SET
  label_en      = EXCLUDED.label_en,
  description   = EXCLUDED.description,
  manager_floor = EXCLUDED.manager_floor,
  owner_floor   = EXCLUDED.owner_floor,
  updated_at    = now();

CREATE OR REPLACE FUNCTION public.required_approver(
  p_kind   text,
  p_amount numeric
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.approval_thresholds;
BEGIN
  IF p_amount IS NULL THEN
    RETURN 'auto';
  END IF;
  SELECT * INTO v_row FROM public.approval_thresholds
   WHERE id = p_kind AND active = true;
  IF NOT FOUND THEN
    RETURN 'auto';
  END IF;
  IF p_amount >= v_row.owner_floor   THEN RETURN 'owner';   END IF;
  IF p_amount >= v_row.manager_floor THEN RETURN 'manager'; END IF;
  RETURN 'auto';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.required_approver(text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.required_approver(text, numeric) TO authenticated;

ALTER TABLE public.repair_proposals DROP CONSTRAINT IF EXISTS repair_proposals_status_check;
ALTER TABLE public.repair_proposals ADD CONSTRAINT repair_proposals_status_check
  CHECK (status IN (
    'draft',
    'pending_owner_approval',
    'sent_to_customer_service',
    'sent_to_customer',
    'partially_approved',
    'fully_approved',
    'rejected',
    'completed'
  ));

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('repair_proposal.needs_owner_approval',
     'Estimate is above the owner approval threshold',
     'approval', 'urgent',
     'role', 'owner', true, false, false,
     'Owner sees the proposal in the bell + approval list'),
  ('repair_proposal.needs_owner_approval',
     'Estimate is above the owner approval threshold',
     'approval', 'urgent',
     'role', 'garage_manager', true, false, false,
     'Manager visibility — they sent it up the chain')
ON CONFLICT DO NOTHING;

-- Trigger: when status flips into pending_owner_approval, fan the notification.
CREATE OR REPLACE FUNCTION public.tg_repair_proposal_owner_approval_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'pending_owner_approval'
     AND (OLD.status IS DISTINCT FROM 'pending_owner_approval') THEN
    PERFORM public.emit_notification(
      'repair_proposal.needs_owner_approval',
      'Repair estimate needs owner approval',
      'Total: ' || coalesce(NEW.total_cost, 0)::text
        || ' — above the owner approval threshold.',
      'repair_proposal',
      NEW.id,
      '/garage/jobs/' || NEW.job_id::text,
      jsonb_build_object(
        'proposal_id', NEW.id,
        'job_id', NEW.job_id,
        'total_cost', NEW.total_cost
      ),
      NEW.created_by,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_repair_proposal_owner_approval_notif ON public.repair_proposals;
CREATE TRIGGER trg_repair_proposal_owner_approval_notif
  AFTER INSERT OR UPDATE OF status ON public.repair_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_repair_proposal_owner_approval_notif();
