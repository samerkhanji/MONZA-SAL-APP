-- ============================================
-- MONZA CRM — Add 'scrapped' to car_status enum
-- Migration 058
--
-- Replaces the in-repo `051_cars_scrapped_deleted_at_policy.sql` (now
-- archived) which tried to ADD VALUE and USE IT in the same transaction
-- — Postgres rejects that. Split into 058 (enum value) and 059
-- (constraint + cleanup using the new value).
--
-- Applied to prod via MCP on 2026-04-29 as `cars_scrapped_enum_value_only`.
-- ============================================

ALTER TYPE public.car_status ADD VALUE IF NOT EXISTS 'scrapped';
