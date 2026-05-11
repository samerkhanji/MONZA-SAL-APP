-- v2 notifications system (per owner spec): every professional app surface.
--
-- Extends the existing notifications table with:
--   - category (filter-tab taxonomy)
--   - severity (info/warning/urgent/critical, with quiet-hour override semantics)
--   - granular event type
--   - related_entity_type/id for deep linking
--   - read_at, dismissed_at, snoozed_until (replaces simple is_read semantics
--     while staying backward compatible)
--   - delivered_*_at columns for per-channel delivery audit
--
-- Adds notification_preferences (per-user channel + quiet hours + mutes).
--
-- Index strategy: bell badge queries filter user_id + unread + un-snoozed,
-- inbox queries filter user_id + (un-dismissed) + (optional category).

DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM (
    'mention',
    'assignment',
    'approval',
    'reply',
    'status_change',
    'alert',
    'customer',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_severity AS ENUM (
    'info',
    'warning',
    'urgent',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category public.notification_category,
  ADD COLUMN IF NOT EXISTS severity public.notification_severity NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS related_entity_id uuid,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_whatsapp_at timestamptz;

CREATE OR REPLACE FUNCTION public.notifications_sync_is_read()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.read_at IS NOT NULL THEN
    NEW.is_read := true;
  ELSIF NEW.is_read = true AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notifications_sync_is_read ON public.notifications;
CREATE TRIGGER trg_notifications_sync_is_read
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_sync_is_read();

UPDATE public.notifications
   SET read_at = COALESCE(read_at, created_at)
 WHERE is_read = true AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_unsnoozed
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON public.notifications(user_id, category, created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related_entity
  ON public.notifications(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_notifications_snooze_due
  ON public.notifications(snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app_enabled     boolean NOT NULL DEFAULT true,
  email_enabled      boolean NOT NULL DEFAULT false,
  whatsapp_enabled   boolean NOT NULL DEFAULT false,
  quiet_hours_start  time,
  quiet_hours_end    time,
  digest_categories  text[] NOT NULL DEFAULT ARRAY[]::text[],
  muted_entity_keys  text[] NOT NULL DEFAULT ARRAY[]::text[],
  desktop_push       boolean NOT NULL DEFAULT false,
  sound_on_critical  boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_sel ON public.notification_preferences;
CREATE POLICY notif_prefs_sel ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS notif_prefs_upd ON public.notification_preferences;
CREATE POLICY notif_prefs_upd ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notif_prefs_ins ON public.notification_preferences;
CREATE POLICY notif_prefs_ins ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  UPDATE public.notifications
     SET read_at = now()
   WHERE id = ANY(p_ids)
     AND user_id = v_caller
     AND read_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  UPDATE public.notifications
     SET read_at = now()
   WHERE user_id = v_caller
     AND read_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

CREATE OR REPLACE FUNCTION public.snooze_notification(p_id uuid, p_until timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.notifications;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  IF p_until IS NULL OR p_until <= now() THEN
    RAISE EXCEPTION 'Snooze time must be in the future' USING errcode = '23514';
  END IF;
  SELECT * INTO v_row FROM public.notifications
   WHERE id = p_id AND user_id = v_caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification not found' USING errcode = '02000';
  END IF;
  IF v_row.severity = 'critical' THEN
    RAISE EXCEPTION 'Critical notifications cannot be snoozed' USING errcode = '42501';
  END IF;
  UPDATE public.notifications
     SET snoozed_until = p_until,
         read_at = NULL
   WHERE id = p_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.snooze_notification(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.snooze_notification(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_notification(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;
  UPDATE public.notifications
     SET dismissed_at = now()
   WHERE id = p_id
     AND user_id = v_caller;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dismiss_notification(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;
