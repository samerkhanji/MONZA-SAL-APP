-- 143_api_rate_limit.sql
--
-- Per-user API rate limiting (AUTH-M1).
--
-- The AI chat endpoint (/api/chat) calls the Anthropic API on every
-- request, so an employee spamming it runs up real cost. This table
-- records one row per accepted request; the route counts a user's
-- recent rows for an endpoint and rejects with 429 once a window
-- threshold is exceeded.
--
-- The table is deliberately minimal — a rolling event log, not a
-- counter. Old rows can be pruned by a future maintenance job; they
-- do not need to survive.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_events_user_endpoint_created
  ON public.api_rate_limit_events(user_id, endpoint, created_at);

ALTER TABLE public.api_rate_limit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY api_rate_limit_events_sel ON public.api_rate_limit_events
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_rate_limit_events_ins ON public.api_rate_limit_events
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT
  ON public.api_rate_limit_events
  TO authenticated;
