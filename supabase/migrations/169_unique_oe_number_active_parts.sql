-- ============================================
-- Monza S.A.L. — unique OE number across active parts
-- Migration 169 (launch QA, 2026-06-02)
--
-- OE (original-equipment) numbers identify a part. The app previously had no
-- uniqueness enforcement, so two parts could share an OE number (production
-- had one such case: two "OE-TEST-001" rows, one an unused test stub). A
-- UI-level guard (web/src/lib/validation/part-oe.ts) now warns on Add/Edit,
-- but this migration adds the database-level guarantee.
--
-- This migration:
--   1. Resolves any pre-existing duplicate OE numbers among active
--      (deleted_at IS NULL) parts by KEEPING the most "real" row per OE
--      number and soft-deleting the rest. "Most real" = most referenced
--      (part_movements + purchase_order_lines + job_parts), then highest
--      quantity, then oldest, then id — a deterministic, stable order.
--   2. Creates a partial, case-insensitive UNIQUE index so future inserts
--      can't reintroduce a duplicate. Soft-deleted rows are excluded, so a
--      removed part's OE number can be reused.
--
-- Idempotent: the dedup is a no-op once data is clean, and the index uses
-- IF NOT EXISTS. (The live database has already been cleaned + indexed; this
-- file keeps the migration history as the source of truth.)
-- ============================================

begin;

-- 1. De-duplicate active parts by OE number (case-insensitive, trimmed).
with ranked as (
  select
    p.id,
    row_number() over (
      partition by lower(btrim(p.oe_number))
      order by
        (
          (select count(*) from public.part_movements m       where m.part_id  = p.id)
          + (select count(*) from public.purchase_order_lines pol where pol.part_id = p.id)
          + (select count(*) from public.job_parts jp          where jp.part_id = p.id)
        ) desc,
        p.quantity desc,
        p.created_at asc,
        p.id asc
    ) as rn
  from public.parts p
  where p.deleted_at is null
    and p.oe_number is not null
    and btrim(p.oe_number) <> ''
)
-- (parts uses a single `deleted_at` soft-delete column — no delete_reason.)
update public.parts
set deleted_at = now()
where id in (select id from ranked where rn > 1);

-- 2. Enforce uniqueness going forward. Partial (active rows only) and
--    case-insensitive so "oe-test-001" and "OE-TEST-001" collide — matching
--    the ilike check in the UI guard.
create unique index if not exists parts_oe_number_unique_active
  on public.parts (lower(btrim(oe_number)))
  where deleted_at is null
    and oe_number is not null
    and btrim(oe_number) <> '';

commit;
