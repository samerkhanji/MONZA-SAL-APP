-- Phase B5: cash reconciliation.
--
-- Model: one drawer (future-proof for multi-drawer), one daily session.
-- Cashier opens at start of day with a counted opening balance. Every
-- cash event during the day attaches to that session via triggers
-- (installment payments, sale deposits) or manual entry (expenses,
-- petty cash, ad-hoc adjustments). At close, cashier enters counted
-- closing; system computes variance = actual - expected.
--
-- Variance threshold: configurable in cash_settings (default $20).
-- |variance| > threshold → requires a written variance_note and flips
-- the session to 'flagged' status; owner gets an urgent notification.

CREATE TABLE IF NOT EXISTS public.cash_drawers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cash_drawers (name) VALUES ('Main Cash Drawer')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cash_settings (
  id                  text PRIMARY KEY DEFAULT 'default',
  variance_threshold  numeric NOT NULL DEFAULT 20,
  currency            text NOT NULL DEFAULT 'USD',
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_settings_singleton CHECK (id = 'default')
);

INSERT INTO public.cash_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id        uuid NOT NULL REFERENCES public.cash_drawers(id) ON DELETE RESTRICT,
  business_date    date NOT NULL DEFAULT CURRENT_DATE,
  opened_at        timestamptz NOT NULL DEFAULT now(),
  opened_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opening_balance  numeric NOT NULL DEFAULT 0,
  opening_note     text,
  closed_at        timestamptz,
  closed_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closing_actual   numeric,
  closing_note     text,
  variance         numeric,
  variance_note    text,
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','flagged','pending_review')),
  reviewed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cash_session_open_per_drawer
  ON public.cash_sessions(drawer_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business_date
  ON public.cash_sessions(business_date DESC);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN (
    'installment_payment',
    'sale_deposit',
    'service_payment',
    'parts_payment',
    'refund',
    'expense',
    'manual_adjustment',
    'opening_float',
    'closing_count'
  )),
  direction    text NOT NULL CHECK (direction IN ('in','out')),
  amount       numeric NOT NULL CHECK (amount > 0),
  currency     text NOT NULL DEFAULT 'USD',
  source_type  text,
  source_id    uuid,
  note         text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON public.cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_source
  ON public.cash_movements(source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cash_movement_per_source
  ON public.cash_movements(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

ALTER TABLE public.cash_drawers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cash_drawers_sel ON public.cash_drawers FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_drawers_write ON public.cash_drawers
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_settings_sel ON public.cash_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_settings_write ON public.cash_settings
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_sessions_sel ON public.cash_sessions
    FOR SELECT TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
      OR public.has_capability('view_reports'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_sessions_owner_write ON public.cash_sessions
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_movements_sel ON public.cash_movements
    FOR SELECT TO authenticated
    USING (
      public.is_owner()
      OR public.has_capability('cashier'::user_capability)
      OR public.has_capability('manage_team'::user_capability)
      OR public.has_capability('view_reports'::user_capability)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_movements_owner_write ON public.cash_movements
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT
  ON public.cash_drawers, public.cash_settings, public.cash_sessions, public.cash_movements
  TO authenticated;
GRANT INSERT, UPDATE
  ON public.cash_sessions, public.cash_movements
  TO authenticated;

INSERT INTO public.notification_event_rules
  (event_type, description, category, severity,
   recipient_kind, recipient_value, channel_inapp, channel_email, channel_whatsapp, note)
VALUES
  ('cash.variance_over_threshold',
     'Cash session closed with variance over threshold',
     'critical', 'urgent',
     'role', 'owner', true, false, false,
     'Owner — daily cash mismatch'),
  ('cash.variance_over_threshold',
     'Cash session closed with variance over threshold',
     'critical', 'urgent',
     'role', 'garage_manager', true, false, false,
     'Manager visibility for daily cash mismatch')
ON CONFLICT DO NOTHING;
