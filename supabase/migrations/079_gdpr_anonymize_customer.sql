-- Audit followup #1: GDPR right-to-erasure for customers.
--
-- Approach: anonymize PII in place, keep the row + relationships so that
-- sales orders / installments / payment plans / car events the dealership
-- legally must retain for tax / audit purposes are not orphaned.
--
-- This is the GDPR-compliant pattern for businesses subject to financial
-- record-keeping obligations (Art. 17 exception for "compliance with a
-- legal obligation").

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS anonymized_at  timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_anonymized_at
  ON public.customers (anonymized_at)
  WHERE anonymized_at IS NOT NULL;

-- Owner-only RPC. Replaces all PII with [Anonymized] / NULL, soft-deletes
-- the row, stamps the audit columns, and writes a system_event for the
-- audit log.
CREATE OR REPLACE FUNCTION public.gdpr_anonymize_customer(
  p_customer_id uuid,
  p_reason text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_active_orders int;
  v_existing public.customers;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if not public.is_owner() then
    raise exception 'Only owners can anonymize customer data' using errcode = '42501';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required (link to GDPR request, ticket, or note)' using errcode = '23514';
  end if;

  select * into v_existing from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer % not found', p_customer_id using errcode = '02000';
  end if;
  if v_existing.anonymized_at is not null then
    raise exception 'Customer already anonymized at %', v_existing.anonymized_at using errcode = '40000';
  end if;

  -- Block while there are still active (non-cancelled, non-delivered) sales
  -- orders. Same rule as the existing customer-delete trigger — finish or
  -- cancel them first so we don't lose process state.
  select count(*) into v_active_orders
    from public.sales_orders
   where customer_id = p_customer_id
     and status NOT IN ('cancelled','delivered');
  if v_active_orders > 0 then
    raise exception 'Cannot anonymize customer with % active sales order(s). Cancel or finish them first.',
      v_active_orders USING errcode = '23503';
  end if;

  update public.customers
     set first_name         = '[Anonymized]',
         last_name          = NULL,
         phone_primary      = NULL,
         phone_secondary    = NULL,
         email              = NULL,
         address            = NULL,
         date_of_birth      = NULL,
         notes              = 'Customer data anonymized per GDPR request.',
         lead_source        = NULL,
         preferred_language = NULL,
         deleted_at         = COALESCE(deleted_at, now()),
         anonymized_at      = now(),
         anonymized_by      = v_caller,
         updated_at         = now()
   where id = p_customer_id;

  insert into public.system_events (event_type, severity, message, metadata)
  values (
    'customer.gdpr_anonymized',
    'warning',
    'Customer ' || p_customer_id::text || ' anonymized per GDPR request',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'actor', v_caller,
      'reason', p_reason
    )
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.gdpr_anonymize_customer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gdpr_anonymize_customer(uuid, text) TO authenticated;
