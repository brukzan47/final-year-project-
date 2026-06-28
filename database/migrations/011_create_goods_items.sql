-- Goods items per declaration (line items)
CREATE TABLE IF NOT EXISTS goods_items (
  goods_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  hs_code VARCHAR(20) NOT NULL,
  description TEXT,
  quantity NUMERIC(12,3),
  unit_of_measure VARCHAR(10),
  value_usd NUMERIC(15,2),
  origin_country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_items_decl ON goods_items(declaration_id);
CREATE INDEX IF NOT EXISTS idx_goods_items_hs ON goods_items(hs_code);

