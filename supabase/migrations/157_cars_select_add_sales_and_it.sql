-- ============================================
-- Monza S.A.L. — add sales + it roles to cars SELECT
-- Migration 157
--
-- public.cars.cars_select_access listed 6 of the 9 user_role enum values
-- ('owner','garage_manager','sales_ops','assistant','hybrid','garage_staff').
-- Missing: 'sales' and 'it'. Latent bug — when a user is given the
-- `sales` role (which the team plans to do for future hires) they
-- cannot read the cars table at all. The IT role similarly can't see
-- inventory, which would block them from supporting any tooling issue.
--
-- This migration adds both. Behavior for existing roles is unchanged.
-- Mirrors the qual style of every other policy on this table (role list
-- via is_any_role_resolved); explicit TO authenticated set by
-- migration 153's hygiene pass.
-- ============================================

DROP POLICY IF EXISTS cars_select_access ON public.cars;
CREATE POLICY cars_select_access
  ON public.cars FOR SELECT TO authenticated
  USING (is_any_role_resolved(ARRAY[
    'owner',
    'garage_manager',
    'sales_ops',
    'sales',
    'assistant',
    'hybrid',
    'it',
    'garage_staff'
  ]::user_role[]));
