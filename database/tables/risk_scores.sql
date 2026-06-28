-- Stores model risk scores and explanations for auditability
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  risk_score INT NOT NULL,
  channel VARCHAR(10) NOT NULL,
  reasons JSONB,
  model_version TEXT,
  features JSONB,
  decided_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_decl ON risk_scores(declaration_id);

