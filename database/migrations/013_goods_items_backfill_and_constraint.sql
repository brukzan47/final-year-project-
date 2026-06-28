-- Backfill goods_items: link items from shipments to their declarations, then enforce exclusive link

-- 1) Backfill: for any declaration whose shipment has items without declaration linkage
UPDATE goods_items gi
SET declaration_id = d.declaration_id
FROM declarations d
JOIN shipments s ON s.shipment_id = d.shipment_id
WHERE gi.shipment_id = s.shipment_id
  AND gi.declaration_id IS NULL;

-- 2) After linking, convert to exclusive linkage by clearing shipment_id on items now linked to declarations
UPDATE goods_items gi
SET shipment_id = NULL
WHERE gi.declaration_id IS NOT NULL
  AND gi.shipment_id IS NOT NULL;

-- 3) Replace the non-null check with an exclusive XOR constraint: exactly one of the two must be non-null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='goods_items' AND constraint_name='goods_items_decl_or_shipment_nn'
  ) THEN
    ALTER TABLE goods_items DROP CONSTRAINT goods_items_decl_or_shipment_nn;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='goods_items' AND constraint_name='goods_items_xor_link'
  ) THEN
    ALTER TABLE goods_items
      ADD CONSTRAINT goods_items_xor_link
      CHECK (
        ((CASE WHEN declaration_id IS NOT NULL THEN 1 ELSE 0 END)
         + (CASE WHEN shipment_id IS NOT NULL THEN 1 ELSE 0 END)) = 1
      );
  END IF;
END$$;

