-- ============================================
-- Add event_date to car_documents
-- Links documents to a specific day's activity (scan, visit, etc.)
-- ============================================

ALTER TABLE car_documents ADD COLUMN IF NOT EXISTS event_date DATE;

CREATE INDEX IF NOT EXISTS idx_car_documents_event_date
  ON car_documents(car_id, event_date);

COMMENT ON COLUMN car_documents.event_date IS 'Optional: date this document relates to (e.g. scan/visit date)';
