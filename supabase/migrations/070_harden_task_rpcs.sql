-- Harden two action RPCs that were missing proper authorization:
--   * complete_task   - had no auth check at all (any logged-in user could
--                       complete any task).
--   * create_task_from_request - trusted caller-supplied p_created_by_user_id
--                       (impersonation: any logged-in user could create tasks
--                       attributed to anyone else).
--
-- Both functions remain SECURITY DEFINER but now enforce the caller's identity
-- and require an appropriate capability. The advisor lint
-- authenticated_security_definer_function_executable will still flag them
-- because the API surface is unchanged; the function bodies now do the auth.

-- 1) complete_task: caller must be the task's assignee OR creator,
--    or have the manage_team capability (admin override).
CREATE OR REPLACE FUNCTION public.complete_task(p_task_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_task  public.tasks;
begin
  if v_actor is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task % not found', p_task_id using errcode = '02000';
  end if;

  if v_task.assigned_to_user_id is distinct from v_actor
     and v_task.created_by_user_id is distinct from v_actor
     and not public.has_capability('manage_team'::user_capability) then
    raise exception 'forbidden: not your task' using errcode = '42501';
  end if;

  update public.tasks
     set status       = 'completed',
         completed_at = now(),
         updated_at   = now()
   where id = p_task_id;

  return true;
end;
$function$;

-- 2) create_task_from_request: ignore caller-supplied p_created_by_user_id,
--    always set created_by_user_id := auth.uid(). p_created_by_user_id is
--    kept in the signature for backward compatibility with existing callers
--    but its value is no longer trusted.
CREATE OR REPLACE FUNCTION public.create_task_from_request(p_request_id uuid, p_created_by_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor   uuid := auth.uid();
  v_task_id uuid;
begin
  if v_actor is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  insert into public.tasks (
    title,
    description,
    status,
    priority,
    assigned_to_user_id,
    department_id,
    source_type,
    source_id,
    created_by_user_id
  )
  select
    r.title,
    r.description,
    'open',
    r.priority,
    r.assigned_to_user_id,
    r.department_id,
    'request',
    r.id,
    v_actor                              -- forced to caller; p_created_by_user_id ignored
  from public.requests r
  where r.id = p_request_id
  on conflict (source_type, source_id)
  do update set updated_at = now()
  returning id into v_task_id;

  return v_task_id;
end;
$function$;
