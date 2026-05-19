-- 122_recall_status_rpc.sql
-- Transactional RPC for recall status transitions.
-- Allowed: open -> active/cancelled, active -> closed/cancelled.
-- closed/cancelled are terminal unless caller is_owner().
-- Sets closed_at when entering closed/cancelled.
-- Permission: is_owner() OR has_capability('garage').

CREATE OR REPLACE FUNCTION public.set_recall_status(
  p_recall_id uuid,
  p_status text
)
RETURNS public.recalls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recall        public.recalls;
  v_caller        uuid := auth.uid();
  v_is_owner      boolean := public.is_owner();
  v_allowed_next  text[];
  v_allowed_statuses constant text[] := ARRAY['open','active','closed','cancelled'];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;
  IF NOT (v_is_owner OR public.has_capability('garage'::user_capability)) THEN
    RAISE EXCEPTION 'Forbidden: requires garage capability' USING errcode = '42501';
  END IF;

  IF p_status IS NULL OR NOT (p_status = ANY (v_allowed_statuses)) THEN
    RAISE EXCEPTION 'Invalid recall status: %', p_status USING errcode = '22023';
  END IF;

  SELECT * INTO v_recall FROM public.recalls WHERE id = p_recall_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recall % not found', p_recall_id USING errcode = '02000';
  END IF;

  IF v_recall.status = p_status THEN
    RETURN v_recall;
  END IF;

  CASE v_recall.status
    WHEN 'open'   THEN v_allowed_next := ARRAY['active','cancelled'];
    WHEN 'active' THEN v_allowed_next := ARRAY['closed','cancelled'];
    ELSE               v_allowed_next := ARRAY[]::text[]; -- terminal: closed, cancelled
  END CASE;

  IF NOT (p_status = ANY (v_allowed_next)) AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Illegal recall transition % -> %',
      v_recall.status, p_status USING errcode = '40000';
  END IF;

  IF p_status IN ('closed','cancelled') THEN
    UPDATE public.recalls
       SET status     = p_status,
           closed_at  = now(),
           updated_at = now()
     WHERE id = p_recall_id
     RETURNING * INTO v_recall;
  ELSE
    UPDATE public.recalls
       SET status     = p_status,
           closed_at  = NULL,
           updated_at = now()
     WHERE id = p_recall_id
     RETURNING * INTO v_recall;
  END IF;

  RETURN v_recall;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_recall_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_recall_status(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_recall_status(uuid, text) TO authenticated;
