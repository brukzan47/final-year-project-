-- 018_risk_engine_phase1.sql

ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_channel VARCHAR(20);
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_reason TEXT;

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_reason TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS override_reason TEXT;

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  risk_score INT NOT NULL,
  channel VARCHAR(20) NOT NULL,
  reasons JSONB,
  model_version TEXT,
  features JSONB,
  decided_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_decl ON risk_scores(declaration_id);
