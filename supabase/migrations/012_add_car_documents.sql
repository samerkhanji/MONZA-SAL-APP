-- ============================================
-- MONZA TECH CRM - Car documents (PDI PDF, Job cards)
-- Migration 012
-- ============================================
-- Upload PDI PDFs and job cards to car/VIN profile

-- Document type enum (create only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'car_document_type') THEN
    CREATE TYPE car_document_type AS ENUM ('pdi', 'job_card');
  END IF;
END $$;

-- Car documents table (metadata for uploaded files)
CREATE TABLE IF NOT EXISTS car_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  document_type car_document_type NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_car_documents_car_id ON car_documents(car_id);
CREATE INDEX IF NOT EXISTS idx_car_documents_type ON car_documents(car_id, document_type);

-- RLS
ALTER TABLE car_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view car documents" ON car_documents;
CREATE POLICY "Authenticated users can view car documents"
  ON car_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert car documents" ON car_documents;
CREATE POLICY "Authenticated users can insert car documents"
  ON car_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete car documents" ON car_documents;
CREATE POLICY "Authenticated users can delete car documents"
  ON car_documents FOR DELETE
  TO authenticated
  USING (true);

-- NOTE: Create the storage bucket "car-documents" in Supabase Dashboard:
-- Storage > New bucket > Name: car-documents, Private, 50MB limit
-- Allowed types: application/pdf, image/jpeg, image/png, image/webp

-- Storage policies for car-documents bucket
DROP POLICY IF EXISTS "car_docs_upload" ON storage.objects;
CREATE POLICY "car_docs_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'car-documents');

DROP POLICY IF EXISTS "car_docs_read" ON storage.objects;
CREATE POLICY "car_docs_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'car-documents');

DROP POLICY IF EXISTS "car_docs_delete" ON storage.objects;
CREATE POLICY "car_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'car-documents');

COMMENT ON TABLE car_documents IS 'Metadata for PDI PDFs and job cards uploaded to car profiles';
