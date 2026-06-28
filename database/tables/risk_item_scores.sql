-- Stores per-goods-item risk scores and explanations
CREATE TABLE IF NOT EXISTS risk_item_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_item_id UUID NOT NULL REFERENCES goods_items(goods_item_id) ON DELETE CASCADE,
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  risk_score INT NOT NULL,
  channel VARCHAR(10) NOT NULL,
  reasons JSONB,
  model_version TEXT,
  decided_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_item_scores_item ON risk_item_scores(goods_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_item_scores_decl ON risk_item_scores(declaration_id);

