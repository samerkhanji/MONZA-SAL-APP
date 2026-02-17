-- Fix car_events.created_by to reference profiles for PostgREST relationship discovery.
-- PostgREST requires FK to profiles to support: select("*, profiles:created_by(full_name)")
-- profiles.id = auth.users.id, so data is compatible.

-- Drop existing FK to auth.users (PostgreSQL default name: tablename_columnname_fkey)
ALTER TABLE car_events DROP CONSTRAINT IF EXISTS car_events_created_by_fkey;

-- Add FK to profiles so PostgREST can discover the relationship
ALTER TABLE car_events
  ADD CONSTRAINT car_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);
