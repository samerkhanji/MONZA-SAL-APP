-- ============================================
-- Monza S.A.L. — plain-language approval-threshold descriptions
-- Migration 171 (launch QA, 2026-06-03)
--
-- The Settings → Approval thresholds page renders approval_thresholds.description
-- verbatim. The seeded copy exposed raw column names ("manager_floor",
-- "owner_floor") to users. Rewrite them to match the on-screen field labels
-- ("Manager floor" / "Owner floor"). Pure copy change; idempotent.
-- ============================================

update public.approval_thresholds
   set description = 'Goodwill given to a customer. A manager can approve up to the owner floor; the owner approves anything above it.'
 where id = 'goodwill';

update public.approval_thresholds
   set description = 'Refund at or above the manager floor needs a manager; at or above the owner floor needs the owner.'
 where id = 'refund';

update public.approval_thresholds
   set description = 'A single parts order. A manager can place orders below the owner floor; the owner approves anything above it.'
 where id = 'parts_order';

update public.approval_thresholds
   set description = 'Estimates at or above the manager floor need manager sign-off; at or above the owner floor need the owner.'
 where id = 'estimate';
