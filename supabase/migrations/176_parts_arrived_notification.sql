-- ============================================
-- Monza S.A.L. — Operational audit Batch 3b (2026-06-11)
-- Wire the dead 'garage_job.parts_arrived' notification rule (seeded in mig
-- 128 but never emitted): when a goods-receipt line lands for a part that a
-- waiting_parts job has on it, alert garage staff that the part arrived so the
-- car stops waiting on a part that's now on the shelf.
--
-- Heuristic link: a waiting_parts garage_job that already has a job_parts row
-- for the received part. (The schema has no explicit job<->PO link; this is the
-- best available signal and only fires when there's a real waiting job.)
-- Additive trigger; idempotent.
-- ============================================

create or replace function public.notify_parts_arrived_for_jobs()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_part_id   uuid;
  v_part_name text;
  v_waiting   int;
begin
  select pol.part_id into v_part_id
  from public.purchase_order_lines pol
  where pol.id = new.po_line_id;

  if v_part_id is null then
    return new;
  end if;

  select count(distinct gj.id) into v_waiting
  from public.garage_jobs gj
  join public.job_parts jp on jp.job_id = gj.id
  where gj.status = 'waiting_parts'
    and jp.part_id = v_part_id
    and gj.deleted_at is null;

  if v_waiting > 0 then
    select part_name into v_part_name from public.parts where id = v_part_id;
    perform public.emit_notification(
      p_event_type          := 'garage_job.parts_arrived',
      p_title               := 'Parts received: ' || coalesce(v_part_name, 'part'),
      p_body                := coalesce(v_part_name, 'A part') || ' (qty '
                               || new.quantity_received || ') was received. '
                               || v_waiting
                               || ' job(s) waiting on parts may be ready to resume.',
      p_related_entity_type := 'part',
      p_related_entity_id   := v_part_id,
      p_link                := '/garage?status=waiting_parts',
      p_metadata            := jsonb_build_object(
                                 'part_id', v_part_id,
                                 'quantity_received', new.quantity_received,
                                 'waiting_jobs', v_waiting
                               )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_parts_arrived_for_jobs on public.purchase_order_receipt_lines;
create trigger trg_notify_parts_arrived_for_jobs
after insert on public.purchase_order_receipt_lines
for each row execute function public.notify_parts_arrived_for_jobs();
