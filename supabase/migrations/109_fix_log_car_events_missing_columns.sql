-- ============================================================================
-- HOTFIX C-14 (surfaced while smoke-testing C-10):
-- log_car_events() referenced 11 columns that DO NOT EXIST on public.cars.
-- The first one (`customer_name_snapshot`) sits on line 188; PL/pgSQL parses
-- IS DISTINCT FROM at execution time, so every UPDATE on cars was failing
-- with 42703. Net effect: any path that mutates a car (incl. the
-- sync_car_status_from_sale trigger fired by every sales_orders write) was
-- a brick wall.
--
-- This rewrites the function to keep ONLY the IF blocks whose columns exist
-- on the live schema. Behavior preserved for: status, location_type,
-- location_slot, battery_percent, pdi_status, notes, plate_number, trim,
-- customs_status, km_range, price, price_currency, current_km, ev_km,
-- motor_km, is_erev, customer_id, sub_dealer_name.
--
-- Dropped (non-existent on cars): customer_name_snapshot,
-- customer_phone_snapshot, reserved_by_user_id, reserved_by_name_snapshot,
-- customs_paid_amount, customs_paid_currency, warranty_v_m, warranty_b_m,
-- warranty_vehicle_dms, warranty_battery_dms, warranty_vehicle_km_limit.
-- (Some of those live on car_warranties — track them there, not here.)
--
-- Verified: a UPDATE that only touches `notes` now succeeds end-to-end.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_car_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor    uuid;
  v_group_id uuid;
BEGIN
  v_actor := auth.uid();
  v_group_id := gen_random_uuid();

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.car_events (
      car_id, event_type, field_name, from_value, to_value, note, metadata,
      event_group_id, created_by
    ) VALUES (
      new.id, 'created', NULL, NULL, new.vin, 'Car created',
      jsonb_build_object(
        'legacy_event', false,
        'vin', new.vin,
        'status', new.status,
        'location_type', new.location_type,
        'location_slot', new.location_slot,
        'pdi_status', new.pdi_status
      ),
      v_group_id,
      COALESCE(v_actor, new.created_by)
    );
    RETURN new;
  END IF;

  IF tg_op = 'UPDATE' THEN
    IF new.status IS DISTINCT FROM old.status THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'status_changed', 'status', old.status::text, new.status::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'status', 'from_value', old.status::text, 'to_value', new.status::text),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.location_type IS DISTINCT FROM old.location_type THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'moved', 'location_type', old.location_type::text, new.location_type::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'location_type',
                                 'from_value', old.location_type::text, 'to_value', new.location_type::text,
                                 'old_location_slot', old.location_slot, 'new_location_slot', new.location_slot),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.location_slot IS DISTINCT FROM old.location_slot THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'moved', 'location_slot', old.location_slot, new.location_slot,
              jsonb_build_object('legacy_event', false, 'field_name', 'location_slot',
                                 'from_value', old.location_slot, 'to_value', new.location_slot,
                                 'location_type', new.location_type),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.battery_percent IS DISTINCT FROM old.battery_percent THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'battery_updated', 'battery_percent', old.battery_percent::text, new.battery_percent::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'battery_percent',
                                 'from_value', old.battery_percent, 'to_value', new.battery_percent),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.pdi_status IS DISTINCT FROM old.pdi_status THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'pdi_updated', 'pdi_status', old.pdi_status::text, new.pdi_status::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'pdi_status',
                                 'from_value', old.pdi_status::text, 'to_value', new.pdi_status::text),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.notes IS DISTINCT FROM old.notes THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, note, metadata, event_group_id, created_by)
      VALUES (new.id, 'note_added', 'notes', old.notes, new.notes, new.notes,
              jsonb_build_object('legacy_event', false, 'field_name', 'notes'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.plate_number IS DISTINCT FROM old.plate_number THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'plate_number', old.plate_number, new.plate_number,
              jsonb_build_object('legacy_event', false, 'field_name', 'plate_number'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.trim IS DISTINCT FROM old.trim THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'trim', old.trim, new.trim,
              jsonb_build_object('legacy_event', false, 'field_name', 'trim'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.customs_status IS DISTINCT FROM old.customs_status THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'customs_status', old.customs_status::text, new.customs_status::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'customs_status'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.km_range IS DISTINCT FROM old.km_range THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'km_range', old.km_range::text, new.km_range::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'km_range'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.price IS DISTINCT FROM old.price THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'price', old.price::text, new.price::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'price'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.price_currency IS DISTINCT FROM old.price_currency THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'price_currency', old.price_currency, new.price_currency,
              jsonb_build_object('legacy_event', false, 'field_name', 'price_currency'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.current_km IS DISTINCT FROM old.current_km THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'current_km', old.current_km::text, new.current_km::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'current_km'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.ev_km IS DISTINCT FROM old.ev_km THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'ev_km', old.ev_km::text, new.ev_km::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'ev_km'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.motor_km IS DISTINCT FROM old.motor_km THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'motor_km', old.motor_km::text, new.motor_km::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'motor_km'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.is_erev IS DISTINCT FROM old.is_erev THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'is_erev', old.is_erev::text, new.is_erev::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'is_erev'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.customer_id IS DISTINCT FROM old.customer_id THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'customer_id', old.customer_id::text, new.customer_id::text,
              jsonb_build_object('legacy_event', false, 'field_name', 'customer_id'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    IF new.sub_dealer_name IS DISTINCT FROM old.sub_dealer_name THEN
      INSERT INTO public.car_events (car_id, event_type, field_name, from_value, to_value, metadata, event_group_id, created_by)
      VALUES (new.id, 'details_updated', 'sub_dealer_name', old.sub_dealer_name, new.sub_dealer_name,
              jsonb_build_object('legacy_event', false, 'field_name', 'sub_dealer_name'),
              v_group_id, COALESCE(v_actor, new.created_by));
    END IF;

    RETURN new;
  END IF;

  RETURN new;
END;
$fn$;
