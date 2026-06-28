import { pool } from "../config/db.js";

export const TrackingAudit = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS tracking_audits (
        audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        old_tracking_ref VARCHAR(80),
        new_tracking_ref VARCHAR(80),
        old_shipment_ref VARCHAR(50),
        new_shipment_ref VARCHAR(50),
        changed_by VARCHAR(120),
        changed_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(q);
    // Ensure columns exist for existing deployments
    await pool.query("ALTER TABLE tracking_audits ADD COLUMN IF NOT EXISTS old_shipment_ref VARCHAR(50);");
    await pool.query("ALTER TABLE tracking_audits ADD COLUMN IF NOT EXISTS new_shipment_ref VARCHAR(50);");
  },

  async insert({ shipment_id, old_tracking_ref, new_tracking_ref, changed_by }) {
    const q = `
      INSERT INTO tracking_audits (shipment_id, old_tracking_ref, new_tracking_ref, changed_by)
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;
    const r = await pool.query(q, [shipment_id, old_tracking_ref, new_tracking_ref, changed_by || null]);
    return r.rows[0];
  },

  async insertShipmentRefChange({ shipment_id, old_shipment_ref, new_shipment_ref, changed_by }) {
    const q = `
      INSERT INTO tracking_audits (shipment_id, old_shipment_ref, new_shipment_ref, changed_by)
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;
    const r = await pool.query(q, [shipment_id, old_shipment_ref, new_shipment_ref, changed_by || null]);
    return r.rows[0];
  },
}; 
