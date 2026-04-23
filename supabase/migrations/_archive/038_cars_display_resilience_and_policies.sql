-- Fix existing public.cars_display (do not drop/recreate).
-- security_invoker: view runs with caller's rights so underlying public.cars RLS applies correctly.
-- Grants + NOTIFY help PostgREST serve the view; public.cars SELECT supports the app fallback query.

ALTER VIEW public.cars_display SET (security_invoker = true);

GRANT SELECT ON public.cars_display TO authenticated;

GRANT SELECT ON public.cars TO authenticated;

NOTIFY pgrst, 'reload schema';
