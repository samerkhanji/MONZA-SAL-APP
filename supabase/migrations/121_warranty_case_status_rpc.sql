-- 121_warranty_case_status_rpc.sql
-- Transactional RPC for warranty_case status transitions.
-- - Validates status against the same enum used by the table CHECK.
-- - Enforces transition rules; terminal statuses lock the case unless caller is_owner().
-- - Sets closed_at/closed_by when entering completed/rejected/cancelled.
-- - Permission: is_owner() OR has_capability('garage').

CREATE OR REPLACE FUNCTION public.set_warranty_case_status(
  p_case_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS public.warranty_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case          public.warranty_cases;
  v_caller        uuid := auth.uid();
  v_is_owner      boolean := public.is_owner();
  v_allowed_next  text[];
  v_allowed_statuses constant text[] := ARRAY[
    'open','investigating','awaiting_parts','in_repair','completed','rejected','cancelled'
  ];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;
  IF NOT (v_is_owner OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Forbidden: requires garage capability' USING errcode = '42501';
  END IF;

  IF p_status IS NULL OR NOT (p_status = ANY (v_allowed_statuses)) THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING errcode = '22023';
  END IF;

  SELECT * INTO v_case FROM public.warranty_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty case % not found', p_case_id USING errcode = '02000';
  END IF;

  -- No-op if no change
  IF v_case.status = p_status THEN
    RETURN v_case;
  END IF;

  CASE v_case.status
    WHEN 'open'           THEN v_allowed_next := ARRAY['investigating','awaiting_parts','in_repair','rejected','cancelled'];
    WHEN 'investigating'  THEN v_allowed_next := ARRAY['awaiting_parts','in_repair','rejected','cancelled'];
    WHEN 'awaiting_parts' THEN v_allowed_next := ARRAY['in_repair','cancelled'];
    WHEN 'in_repair'      THEN v_allowed_next := ARRAY['completed','cancelled'];
    ELSE                       v_allowed_next := ARRAY[]::text[]; -- terminal: completed, rejected, cancelled
  END CASE;

  IF NOT (p_status = ANY (v_allowed_next)) AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Illegal transition % -> % (terminal or not allowed)',
      v_case.status, p_status USING errcode = '40000';
  END IF;

  IF p_status IN ('completed','rejected','cancelled') THEN
    UPDATE public.warranty_cases
       SET status     = p_status,
           closed_at  = now(),
           closed_by  = v_caller,
           notes      = CASE
                          WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0
                          THEN COALESCE(notes || E'\n', '') || '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] ' || p_note
                          ELSE notes
                        END,
           updated_at = now()
     WHERE id = p_case_id
     RETURNING * INTO v_case;
  ELSE
    UPDATE public.warranty_cases
       SET status     = p_status,
           closed_at  = NULL,
           closed_by  = NULL,
           notes      = CASE
                          WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0
                          THEN COALESCE(notes || E'\n', '') || '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] ' || p_note
                          ELSE notes
                        END,
           updated_at = now()
     WHERE id = p_case_id
     RETURNING * INTO v_case;
  END IF;

  RETURN v_case;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_warranty_case_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_warranty_case_status(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_warranty_case_status(uuid, text, text) TO authenticated;
