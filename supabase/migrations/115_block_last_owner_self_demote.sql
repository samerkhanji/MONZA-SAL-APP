-- 115_block_last_owner_self_demote.sql
--
-- Safety net: never let the system end up with zero active owners.
-- Triggered on profiles BEFORE UPDATE/DELETE. If the change would remove
-- the last active owner (role change away from 'owner', soft-deactivation,
-- or hard delete), raise SQLSTATE 40000.
--
-- Uses 40000 (transaction_integrity_constraint_violation) to make this
-- distinguishable from generic check errors at the API layer.

CREATE OR REPLACE FUNCTION public.block_last_owner_self_demote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_was_active_owner boolean;
  v_still_active_owner boolean;
  v_other_owner_count integer;
BEGIN
  -- Only relevant if the OLD row WAS an active owner.
  v_was_active_owner := (OLD.user_role = 'owner'::user_role
                         AND COALESCE(OLD.is_active, false) = true);

  IF NOT v_was_active_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_still_active_owner := false;
  ELSE
    v_still_active_owner := (NEW.user_role = 'owner'::user_role
                             AND COALESCE(NEW.is_active, false) = true);
  END IF;

  -- If the row remains an active owner, nothing to enforce.
  IF v_still_active_owner THEN
    RETURN NEW;
  END IF;

  -- The row is losing its active-owner status. Make sure at least one
  -- OTHER active owner still exists.
  SELECT count(*) INTO v_other_owner_count
    FROM public.profiles
   WHERE user_role = 'owner'::user_role
     AND is_active = true
     AND id <> OLD.id;

  IF v_other_owner_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40000',
      MESSAGE = 'Cannot demote, deactivate, or delete the last active owner.',
      HINT    = 'Promote another profile to owner first.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_last_owner_self_demote_upd ON public.profiles;
CREATE TRIGGER trg_block_last_owner_self_demote_upd
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.user_role = 'owner'::user_role
        AND COALESCE(OLD.is_active, false) = true
        AND (NEW.user_role <> 'owner'::user_role
             OR COALESCE(NEW.is_active, false) = false))
  EXECUTE FUNCTION public.block_last_owner_self_demote();

DROP TRIGGER IF EXISTS trg_block_last_owner_self_demote_del ON public.profiles;
CREATE TRIGGER trg_block_last_owner_self_demote_del
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.user_role = 'owner'::user_role
        AND COALESCE(OLD.is_active, false) = true)
  EXECUTE FUNCTION public.block_last_owner_self_demote();
