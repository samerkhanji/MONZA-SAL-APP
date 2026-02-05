-- ============================================
-- OPTIONAL: Allow anon access for internal app
-- ============================================
-- Run this ONLY if you use the web app without Supabase Auth
-- (internal system, no public URL). Otherwise use Auth and keep "authenticated" only.

-- Cars: anon can read/insert/update (for list, add, move)
DROP POLICY IF EXISTS "Authenticated users can view all cars" ON cars;
DROP POLICY IF EXISTS "Authenticated users can insert cars" ON cars;
DROP POLICY IF EXISTS "Authenticated users can update cars" ON cars;

CREATE POLICY "Allow anon internal cars select" ON cars FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon internal cars insert" ON cars FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon internal cars update" ON cars FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Car events: anon can read/insert
DROP POLICY IF EXISTS "Authenticated users can view all car events" ON car_events;
DROP POLICY IF EXISTS "Authenticated users can insert car events" ON car_events;

CREATE POLICY "Allow anon internal car_events select" ON car_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon internal car_events insert" ON car_events FOR INSERT TO anon WITH CHECK (true);

-- Views: cars_display and cars_with_sales read from cars (already allowed above)
-- No extra policy needed for views if underlying table allows select.
