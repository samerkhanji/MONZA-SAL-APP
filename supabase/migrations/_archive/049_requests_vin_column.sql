ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS vin TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_vin ON public.requests (vin)
  WHERE vin IS NOT NULL AND length(trim(vin)) > 0;

COMMENT ON COLUMN public.requests.vin IS 'Optional VIN for service/inventory/order-related requests.';
