-- Add shipment linkage to goods_items to allow itemization at shipment stage
ALTER TABLE goods_items ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE;

-- Ensure at least one of (declaration_id, shipment_id) is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='goods_items' AND constraint_name='goods_items_decl_or_shipment_nn'
  ) THEN
    ALTER TABLE goods_items
      ADD CONSTRAINT goods_items_decl_or_shipment_nn
      CHECK ((declaration_id IS NOT NULL) OR (shipment_id IS NOT NULL));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_goods_items_shipment ON goods_items(shipment_id);

