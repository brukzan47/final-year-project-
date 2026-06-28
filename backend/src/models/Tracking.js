import { pool } from "../config/db.js";

export const Tracking = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS tracking (
        tracking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_id UUID UNIQUE REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        lat NUMERIC(9,6),
        lon NUMERIC(9,6),
        speed NUMERIC(7,2),
        heading NUMERIC(7,2),
        vessel_name VARCHAR(100),
        last_seen TIMESTAMP DEFAULT now(),
        eta_delivery TIMESTAMP NULL,
        customs_status VARCHAR(40),
        clearance_progress INT DEFAULT 0,
        extra JSONB
      );
    `;
    await pool.query(query);
  },

  async upsert(shipment_id, data) {
    const query = `
      INSERT INTO tracking (shipment_id, lat, lon, speed, heading, vessel_name, last_seen, eta_delivery, customs_status, clearance_progress, extra)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, now()),$8,$9,COALESCE($10,0),$11)
      ON CONFLICT (shipment_id)
      DO UPDATE SET
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        vessel_name = COALESCE(EXCLUDED.vessel_name, tracking.vessel_name),
        last_seen = COALESCE(EXCLUDED.last_seen, now()),
        eta_delivery = COALESCE(EXCLUDED.eta_delivery, tracking.eta_delivery),
        customs_status = COALESCE(EXCLUDED.customs_status, tracking.customs_status),
        clearance_progress = COALESCE(EXCLUDED.clearance_progress, tracking.clearance_progress),
        extra = COALESCE(EXCLUDED.extra, tracking.extra)
      RETURNING *;
    `;
    const values = [
      shipment_id,
      data.lat ?? null,
      data.lon ?? null,
      data.speed ?? null,
      data.heading ?? null,
      data.vessel_name ?? null,
      data.last_seen ?? null,
      data.eta_delivery ?? null,
      data.customs_status ?? null,
      data.clearance_progress ?? null,
      data.extra ? JSON.stringify(data.extra) : null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getByShipment(shipment_id) {
    const result = await pool.query(`
      SELECT t.* FROM tracking t WHERE t.shipment_id = $1;
    `, [shipment_id]);
    return result.rows[0] || null;
  },
};

