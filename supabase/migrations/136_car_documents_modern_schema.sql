-- ============================================
-- MONZA CRM - Align car_documents to the modern document schema
-- Migration 136
--
-- car_documents was created with a legacy column layout
-- (storage_path / file_size_bytes / uploaded_at) and a 2-value
-- document_type enum (pdi, job_card). Every car-document UI component
-- writes the modern schema used by customer_documents
-- (file_path / file_size / mime_type / notes / created_at) and offers
-- many more document types, so uploads failed with schema-cache errors
-- for every type except PDI reports and job cards. The table is empty,
-- so this aligns it safely. Legacy columns are kept (nullable) for
-- backward compatibility with car-day-detail-dialog.
--
-- Applied to live project okxpsvukzjjubinhamek as
-- `car_documents_modern_schema`.
-- ============================================

ALTER TABLE public.car_documents
  ADD COLUMN IF NOT EXISTS file_path  text,
  ADD COLUMN IF NOT EXISTS file_size  bigint,
  ADD COLUMN IF NOT EXISTS mime_type  text,
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Modern writers populate file_path; storage_path is no longer required.
ALTER TABLE public.car_documents ALTER COLUMN storage_path DROP NOT NULL;

-- The UI offers inspection_photo, customer_document, insurance_document,
-- customs_document, other_document, etc. customer_documents already uses
-- free text for document_type -- match it.
ALTER TABLE public.car_documents
  ALTER COLUMN document_type TYPE text USING document_type::text;
