-- Smart features: semantic index + OCR extracts (MVP)

-- Embeddings/semantic index (MVP stores as JSONB of floats)
CREATE TABLE IF NOT EXISTS smart_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  text TEXT NOT NULL,
  embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS smart_index_type_updated_idx ON smart_index(entity_type, updated_at DESC);

-- OCR extracted fields (MVP)
CREATE TABLE IF NOT EXISTS ocr_extracts (
  extract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocr_extracts_doc_idx ON ocr_extracts(document_id);

