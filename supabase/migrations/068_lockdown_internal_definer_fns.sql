-- 068: Revoke REST-callable EXECUTE from internal/trigger SECURITY DEFINER fns.
-- These were flagged by the Supabase advisor (lint 0028 + 0029) after 062-067.
-- Triggers don't need REST execute; helpers are called from inside other
-- DEFINER fns (which run with the function owner's privileges, so revokes
-- here don't break the call chain).

-- Internal capability helper
revoke execute on function public._require_any_capability(user_capability[]) from public, anon, authenticated;

-- Trigger functions (terminal-state guards)
revoke execute on function public.cars_block_terminal_status_revert()         from public, anon, authenticated;
revoke execute on function public.sales_orders_block_terminal_status_revert() from public, anon, authenticated;
revoke execute on function public.garage_jobs_block_terminal_status_revert()  from public, anon, authenticated;

-- Trigger functions (audit + notification)
revoke execute on function public.log_status_change_to_system_events() from public, anon, authenticated;
revoke execute on function public.parts_notify_low_stock()              from public, anon, authenticated;

-- Cron-callable warranty notifier (already restricted; ensure anon explicitly revoked)
revoke execute on function public.notify_expiring_warranties(int) from public, anon, authenticated;
grant  execute on function public.notify_expiring_warranties(int) to service_role;
