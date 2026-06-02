-- ============================================================================
-- 169_dedupe_emit_notification_recipients.sql
--
-- Bug: a single event can have several active notification_event_rules whose
-- recipient pools overlap. For example cash.variance_over_threshold has rules
-- for role=owner, role=garage_manager and capability=cashier. An owner who
-- also holds the cashier capability matched two rules and received TWO
-- identical notifications for the same event (same content, same timestamp).
--
-- Fix: dedupe recipients across all matching rules within a single
-- emit_notification() call, so each user gets at most one notification per
-- emission. The first matching rule wins for category/severity (rule order is
-- unchanged); subsequent matches for the same user are skipped.
--
-- This re-creates the function from migration 088 verbatim, adding only the
-- v_sent_ids guard.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_event_type            text,
  p_title                 text,
  p_body                  text,
  p_related_entity_type   text DEFAULT NULL,
  p_related_entity_id     uuid DEFAULT NULL,
  p_link                  text DEFAULT NULL,
  p_metadata              jsonb DEFAULT '{}'::jsonb,
  p_event_subject_user_id uuid DEFAULT NULL,
  p_event_submitter_id    uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rule          public.notification_event_rules;
  v_recipient_ids uuid[];
  v_user_id       uuid;
  v_count         integer := 0;
  v_entity_key    text;
  v_prefs         public.notification_preferences;
  -- Users already notified in THIS call — prevents duplicate rows when a user
  -- matches more than one rule for the same event_type.
  v_sent_ids      uuid[] := ARRAY[]::uuid[];
BEGIN
  v_entity_key := CASE
    WHEN p_related_entity_type IS NOT NULL AND p_related_entity_id IS NOT NULL
    THEN p_related_entity_type || ':' || p_related_entity_id::text
    ELSE NULL
  END;

  FOR v_rule IN
    SELECT * FROM public.notification_event_rules
     WHERE event_type = p_event_type AND active = true
  LOOP
    v_recipient_ids := CASE v_rule.recipient_kind
      WHEN 'user' THEN ARRAY[v_rule.recipient_value::uuid]

      WHEN 'role' THEN (
        SELECT array_agg(p.id) FROM public.profiles p
         WHERE p.is_active = true
           AND (
             p.user_role::text = v_rule.recipient_value
             OR (
               p.user_role = 'hybrid'
               AND (
                 (v_rule.recipient_value = 'garage_staff'
                   AND 'garage'::user_capability = ANY(p.capabilities))
                 OR (v_rule.recipient_value = 'garage_manager'
                   AND 'garage'::user_capability = ANY(p.capabilities)
                   AND 'manage_team'::user_capability = ANY(p.capabilities))
                 OR (v_rule.recipient_value = 'assistant'
                   AND ('cashier'::user_capability = ANY(p.capabilities)
                        OR 'data_health'::user_capability = ANY(p.capabilities)))
               )
             )
           )
      )

      WHEN 'capability' THEN (
        SELECT array_agg(p.id) FROM public.profiles p
         WHERE p.is_active = true
           AND v_rule.recipient_value::user_capability = ANY(
             COALESCE(p.capabilities, ARRAY[]::user_capability[])
           )
      )

      WHEN 'event_subject_owner' THEN (
        CASE WHEN p_event_subject_user_id IS NOT NULL
             THEN ARRAY[p_event_subject_user_id] ELSE NULL END
      )

      WHEN 'event_submitter' THEN (
        CASE WHEN p_event_submitter_id IS NOT NULL
             THEN ARRAY[p_event_submitter_id] ELSE NULL END
      )
    END;

    IF v_recipient_ids IS NULL THEN CONTINUE; END IF;

    FOREACH v_user_id IN ARRAY v_recipient_ids LOOP
      -- Skip if this user was already notified for this event in this call.
      IF v_user_id = ANY(v_sent_ids) THEN CONTINUE; END IF;

      SELECT * INTO v_prefs FROM public.notification_preferences
       WHERE user_id = v_user_id;

      IF v_prefs.user_id IS NOT NULL
         AND v_entity_key IS NOT NULL
         AND v_entity_key = ANY(v_prefs.muted_entity_keys)
      THEN CONTINUE; END IF;

      INSERT INTO public.notifications (
        user_id, category, severity, event_type,
        title, message, link,
        related_entity_type, related_entity_id,
        metadata, is_read
      ) VALUES (
        v_user_id, v_rule.category, v_rule.severity, p_event_type,
        p_title, p_body, p_link,
        p_related_entity_type, p_related_entity_id,
        p_metadata, false
      );
      v_sent_ids := array_append(v_sent_ids, v_user_id);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.emit_notification(text, text, text, text, uuid, text, jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
