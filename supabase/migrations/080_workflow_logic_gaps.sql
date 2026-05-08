-- Wave 2 of the deep audit: closes workflow logic gaps.
--
-- B3 — test drives had no outcome field (the whole purpose of a test drive
--      is what the customer thought of the car).
-- B4/H12 — when a test drive ends with "interested" / "purchased", the
--      customer's lead_status should progress.
-- H7 — when a repair proposal is approved, the approved items should
--      auto-populate the linked job's work_checklist.
-- H11 — keep requests.send_to / send_to_user_id in sync going forward.

-- ============================================================================
-- B3: test_drives.outcome
-- ============================================================================

-- Use a TEXT column with a CHECK rather than a new ENUM, so we can extend
-- vocabulary later (e.g. "follow_up_scheduled") without an ALTER TYPE dance.
ALTER TABLE public.test_drives
  ADD COLUMN IF NOT EXISTS outcome text;

ALTER TABLE public.test_drives
  DROP CONSTRAINT IF EXISTS test_drives_outcome_check;

ALTER TABLE public.test_drives
  ADD CONSTRAINT test_drives_outcome_check
  CHECK (
    outcome IS NULL
    OR outcome IN ('interested', 'not_interested', 'purchased', 'no_decision')
  );

COMMENT ON COLUMN public.test_drives.outcome IS
  'Customer outcome captured at return. NULL until the test drive is completed.';

-- ============================================================================
-- H12: auto-progress customer lead_status when outcome is set on a test drive.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_test_drives_progress_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.outcome IS NOT NULL
     AND NEW.customer_id IS NOT NULL
     AND (OLD.outcome IS DISTINCT FROM NEW.outcome) THEN
    -- "purchased" wins — but the actual conversion happens via complete_delivery,
    -- so we only nudge to 'negotiation' here, not 'converted'. complete_delivery
    -- still writes 'converted' on actual delivery.
    IF NEW.outcome = 'purchased' THEN
      UPDATE public.customers
         SET lead_status = 'negotiation'::lead_status, updated_at = now()
       WHERE id = NEW.customer_id
         AND lead_status NOT IN ('converted', 'lost');
    ELSIF NEW.outcome = 'interested' THEN
      UPDATE public.customers
         SET lead_status = 'interested'::lead_status, updated_at = now()
       WHERE id = NEW.customer_id
         AND lead_status NOT IN ('converted', 'lost', 'negotiation', 'interested');
    ELSIF NEW.outcome = 'not_interested' THEN
      UPDATE public.customers
         SET lead_status = 'lost'::lead_status, updated_at = now()
       WHERE id = NEW.customer_id
         AND lead_status NOT IN ('converted', 'lost');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_test_drives_progress_lead() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_test_drives_progress_lead ON public.test_drives;
CREATE TRIGGER trg_test_drives_progress_lead
  AFTER UPDATE OF outcome ON public.test_drives
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_test_drives_progress_lead();

-- ============================================================================
-- H7: when a repair_proposal is approved (fully or partially), append
--     each approved item to the linked job's work_checklist.
--
-- garage_jobs.work_checklist is JSONB array of {label, done} objects.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_repair_proposals_sync_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_existing jsonb;
  v_to_append jsonb;
BEGIN
  -- Fire only when status transitions INTO an approved state
  IF NEW.status NOT IN ('partially_approved', 'fully_approved') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;  -- no transition, nothing to do
  END IF;

  -- Build a JSONB array of {label, done:false, source:'proposal:<id>'} from
  -- the proposal's approved items.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', i.title,
        'done',  false,
        'source', 'proposal:' || NEW.id::text,
        'item_id', i.id
      )
    ),
    '[]'::jsonb
  )
    INTO v_to_append
    FROM public.repair_proposal_items i
   WHERE i.proposal_id = NEW.id
     AND i.customer_decision = 'approved';

  -- Read existing checklist from the job (default to []).
  SELECT coalesce(work_checklist, '[]'::jsonb)
    INTO v_existing
    FROM public.garage_jobs
   WHERE id = NEW.job_id;

  -- Skip if already populated from this proposal (idempotent: don't double-append
  -- if the trigger fires twice or proposal is re-approved).
  IF v_existing @> jsonb_build_array(jsonb_build_object('source', 'proposal:' || NEW.id::text)) THEN
    -- Already populated from this proposal; do nothing.
    RETURN NEW;
  END IF;

  -- Append.
  UPDATE public.garage_jobs
     SET work_checklist = v_existing || v_to_append,
         updated_at = now()
   WHERE id = NEW.job_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_repair_proposals_sync_checklist() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_repair_proposals_sync_checklist ON public.repair_proposals;
CREATE TRIGGER trg_repair_proposals_sync_checklist
  AFTER UPDATE OF status ON public.repair_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_repair_proposals_sync_checklist();

-- ============================================================================
-- H11: keep requests.send_to <-> send_to_user_id in sync.
--
-- If a row has send_to_user_id but send_to is null, populate send_to from
-- the profile's full_name. We don't string-match the other direction —
-- legacy 'send_to = "houssam"' rows are left alone because the value
-- isn't always a unique identifier.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_requests_sync_send_to()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.send_to_user_id IS NOT NULL
     AND (NEW.send_to IS NULL OR trim(NEW.send_to) = '') THEN
    SELECT full_name INTO v_name
      FROM public.profiles
     WHERE id = NEW.send_to_user_id;
    IF v_name IS NOT NULL THEN
      NEW.send_to := v_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_requests_sync_send_to() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_requests_sync_send_to ON public.requests;
CREATE TRIGGER trg_requests_sync_send_to
  BEFORE INSERT OR UPDATE OF send_to_user_id ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_requests_sync_send_to();
