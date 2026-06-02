-- Enable pg_trgm so fuzzy customer/vehicle search uses GiST/GIN indexes
-- instead of falling back to sequential scan. Surfaced by the launch
-- readiness audit (CHUNK security findings, decision 3).

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
