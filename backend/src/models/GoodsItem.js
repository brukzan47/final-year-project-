import { pool } from "../config/db.js";

export const GoodsItem = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS goods_items (
        goods_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        hs_code VARCHAR(20) NOT NULL,
        description TEXT,
        quantity NUMERIC(12,3),
        unit_of_measure VARCHAR(10),
        value_usd NUMERIC(15,2),
        origin_country VARCHAR(100),
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_goods_items_decl ON goods_items(declaration_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_goods_items_hs ON goods_items(hs_code);");
    await pool.query("ALTER TABLE goods_items ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE;");
    await pool.query(`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='goods_items' AND constraint_name='goods_items_decl_or_shipment_nn'
        ) THEN
          ALTER TABLE goods_items ADD CONSTRAINT goods_items_decl_or_shipment_nn CHECK ((declaration_id IS NOT NULL) OR (shipment_id IS NOT NULL));
        END IF;
      END$$;`);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_goods_items_shipment ON goods_items(shipment_id);");
  },

  async create(data) {
    const fields = [
      "declaration_id",
      "shipment_id",
      "hs_code",
      "description",
      "quantity",
      "unit_of_measure",
      "value_usd",
      "origin_country",
    ];
    const keys = fields.filter((k) => data[k] !== undefined);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
    const q = `INSERT INTO goods_items (${keys.join(",")}) VALUES (${placeholders}) RETURNING *;`;
    const vals = keys.map((k) => data[k]);
    const r = await pool.query(q, vals);
    return r.rows[0];
  },

  async listByDeclaration(declarationId) {
    const r = await pool.query(
      `SELECT * FROM goods_items WHERE declaration_id=$1 ORDER BY created_at DESC`,
      [declarationId]
    );
    return r.rows;
  },

  async listByShipment(shipmentId) {
    const r = await pool.query(
      `SELECT * FROM goods_items WHERE shipment_id=$1 ORDER BY created_at DESC`,
      [shipmentId]
    );
    return r.rows;
  },

  async updateFields(id, fields) {
    const allowed = new Set([
      "hs_code",
      "description",
      "quantity",
      "unit_of_measure",
      "value_usd",
      "origin_country",
      "declaration_id",
      "shipment_id",
    ]);
    const entries = Object.entries(fields || {}).filter(([k]) => allowed.has(k));
    if (entries.length === 0) return null;
    const set = entries.map(([k], i) => `${k}=$${i + 2}`).join(", ");
    const values = [id, ...entries.map(([, v]) => v)];
    const r = await pool.query(`UPDATE goods_items SET ${set} WHERE goods_item_id=$1 RETURNING *;`, values);
    return r.rows[0] || null;
  },

  async remove(id) {
    await pool.query(`DELETE FROM goods_items WHERE goods_item_id=$1`, [id]);
    return { ok: true };
  },
};
