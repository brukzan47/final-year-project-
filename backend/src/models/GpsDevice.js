import { pool } from "../config/db.js";

export const GpsDevice = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS gps_devices (
        device_id VARCHAR(80) PRIMARY KEY,
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE SET NULL,
        container_no VARCHAR(20),
        transport_company VARCHAR(120),
        driver_name VARCHAR(120),
        driver_phone VARCHAR(30),
        active BOOLEAN DEFAULT TRUE,
        registered_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_gps_devices_container ON gps_devices(container_no);");
  },

  async register(data) {
    const q = `
      INSERT INTO gps_devices (device_id, shipment_id, container_no, transport_company, driver_name, driver_phone, active)
      VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, TRUE))
      ON CONFLICT (device_id) DO UPDATE SET
        shipment_id = EXCLUDED.shipment_id,
        container_no = EXCLUDED.container_no,
        transport_company = EXCLUDED.transport_company,
        driver_name = EXCLUDED.driver_name,
        driver_phone = EXCLUDED.driver_phone,
        active = EXCLUDED.active
      RETURNING *;
    `;
    const v = [
      data.device_id,
      data.shipment_id || null,
      data.container_no || null,
      data.transport_company || null,
      data.driver_name || null,
      data.driver_phone || null,
      data.active,
    ];
    const r = await pool.query(q, v);
    return r.rows[0];
  },

  async getById(device_id) {
    const r = await pool.query(`SELECT * FROM gps_devices WHERE device_id=$1 LIMIT 1`, [device_id]);
    return r.rows[0] || null;
  },

  async list() {
    const r = await pool.query(`SELECT * FROM gps_devices ORDER BY registered_at DESC`);
    return r.rows;
  },
};

