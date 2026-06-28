import { pool } from "../config/db.js";
import { createUniqueIndexIfClean } from "../utils/dbInit.js";

export const Shipment = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS shipments (
        shipment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        importer_id UUID REFERENCES importers(importer_id) ON DELETE CASCADE,
        shipment_reference VARCHAR(50),
        tracking_ref VARCHAR(80),
        description_of_goods TEXT,
        goods_type VARCHAR(40),
        hs_code VARCHAR(15),
        quantity NUMERIC(10,2),
        unit_of_measure VARCHAR(10),
        cif_value_usd NUMERIC(15,2),
        origin_country VARCHAR(60),
        destination_port VARCHAR(60),
        mode_of_transport VARCHAR(30),
        arrival_date DATE,
      created_at TIMESTAMP DEFAULT now()
    );
    `;
    await pool.query(query);
    await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS goods_type VARCHAR(40);");
    await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_ref VARCHAR(80);");
    // Ensure column length is aligned to 50
    try { await pool.query("ALTER TABLE shipments ALTER COLUMN shipment_reference TYPE VARCHAR(50);"); } catch {}
    await createUniqueIndexIfClean(
      "idx_shipments_tracking_ref_unique",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tracking_ref_unique ON shipments(tracking_ref) WHERE tracking_ref IS NOT NULL;"
    );
    await createUniqueIndexIfClean(
      "idx_shipments_shipment_ref_unique",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_shipment_ref_unique ON shipments(shipment_reference) WHERE shipment_reference IS NOT NULL;"
    );
  },

  async create(data) {
    const client = await pool.connect();
    const query = `
      INSERT INTO shipments
      (importer_id, shipment_reference, tracking_ref, description_of_goods, goods_type, hs_code,
       quantity, unit_of_measure, cif_value_usd, origin_country,
       destination_port, mode_of_transport, arrival_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING shipment_id, shipment_reference, tracking_ref, description_of_goods, goods_type;
    `;
    const values = [
      data.importer_id,
      data.shipment_reference,
      data.tracking_ref || null,
      data.description_of_goods,
      data.goods_type,
      data.hs_code,
      data.quantity,
      data.unit_of_measure,
      data.cif_value_usd,
      data.origin_country,
      data.destination_port,
      data.mode_of_transport,
      data.arrival_date,
    ];
    try {
      await client.query("BEGIN");
      if (data.shipment_reference) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`shipment_reference:${data.shipment_reference}`]);
        const duplicate = await client.query(
          "SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1",
          [data.shipment_reference]
        );
        if (duplicate.rowCount) {
          const error = new Error("Shipment reference already in use");
          error.code = "23505";
          throw error;
        }
      }
      if (data.tracking_ref) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tracking_ref:${data.tracking_ref}`]);
        const duplicate = await client.query(
          "SELECT shipment_id FROM shipments WHERE tracking_ref=$1 LIMIT 1",
          [data.tracking_ref]
        );
        if (duplicate.rowCount) {
          const error = new Error("Tracking reference already in use");
          error.code = "23505";
          throw error;
        }
      }
      const result = await client.query(query, values);
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getAll() {
    const result = await pool.query(`
      SELECT s.*, i.company_name
      FROM shipments s JOIN importers i ON s.importer_id=i.importer_id
      ORDER BY s.created_at DESC;
    `);
    return result.rows;
  },

  async getByReference(ref) {
    const result = await pool.query(`
      SELECT * FROM shipments 
      WHERE shipment_reference = $1 OR tracking_ref = $1 
      ORDER BY tracking_ref IS NOT NULL DESC 
      LIMIT 1;
    `, [ref]);
    return result.rows[0] || null;
  },

  async updateFields(id, fields) {
    const allowed = new Set([
      'shipment_reference',
      'tracking_ref',
      'description_of_goods',
      'goods_type',
      'hs_code',
      'quantity',
      'unit_of_measure',
      'cif_value_usd',
      'origin_country',
      'destination_port',
      'mode_of_transport',
      'arrival_date',
    ]);
    const entries = Object.entries(fields || {}).filter(([k, _]) => allowed.has(k));
    if (entries.length === 0) return null;
    const set = entries.map(([k, _], i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...entries.map(([_, v]) => v)];
    const q = await pool.query(`UPDATE shipments SET ${set} WHERE shipment_id=$1 RETURNING *;`, values);
    return q.rows[0] || null;
  },
};
