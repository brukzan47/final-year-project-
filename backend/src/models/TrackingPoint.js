import { pool } from "../config/db.js";

export const TrackingPoint = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS tracking_points (
        id BIGSERIAL PRIMARY KEY,
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        lat NUMERIC(9,6) NOT NULL,
        lon NUMERIC(9,6) NOT NULL,
        speed NUMERIC(7,2),
        heading NUMERIC(7,2),
        predicted BOOLEAN DEFAULT false,
        seen_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tracking_points_shipment_time ON tracking_points(shipment_id, seen_at DESC);
    `;
    await pool.query(query);
  },

  async insert({ shipment_id, lat, lon, speed, heading, predicted = false, seen_at }) {
    const q = `
      INSERT INTO tracking_points (shipment_id, lat, lon, speed, heading, predicted, seen_at)
      VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now())) RETURNING id;
    `;
    const v = [shipment_id, lat, lon, speed ?? null, heading ?? null, !!predicted, seen_at || null];
    await pool.query(q, v);
  },

  async listByShipment(shipment_id, limit = 50) {
    const q = `
      SELECT lat, lon, speed, heading, predicted, seen_at
      FROM tracking_points WHERE shipment_id=$1
      ORDER BY seen_at DESC
      LIMIT $2;
    `;
    const r = await pool.query(q, [shipment_id, Math.max(1, Math.min(500, Number(limit) || 50))]);
    return r.rows;
  },
};

