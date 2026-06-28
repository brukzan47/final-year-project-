import { pool } from "../config/db.js";

export const Declaration = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS declarations (
        declaration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        declaration_no VARCHAR(50) UNIQUE NOT NULL,
        declaration_date DATE NOT NULL,
        declarant_agent VARCHAR(100),
        customs_station VARCHAR(80),
        valuation_basis VARCHAR(10),
        currency CHAR(3),
        tariff_rate NUMERIC(5,2),
        duties_etb NUMERIC(15,2),
        payment_receipt_no VARCHAR(30),
        status VARCHAR(20) DEFAULT 'Pending',
        status_reason TEXT,
        risk_score INTEGER DEFAULT 0,
        risk_channel VARCHAR(20),
        risk_reason TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending';");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS status_reason TEXT;");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_channel VARCHAR(20);");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_reason TEXT;");
    try { await pool.query("ALTER TABLE declarations ALTER COLUMN declaration_no TYPE VARCHAR(50);"); } catch {}
  },

  async create(data) {
    const query = `
      INSERT INTO declarations
      (shipment_id, declaration_no, declaration_date, declarant_agent, customs_station,
       valuation_basis, currency, tariff_rate, duties_etb, payment_receipt_no,
       risk_score, risk_channel, risk_reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING declaration_id, declaration_no, declaration_date, risk_score, risk_channel, risk_reason;
    `;
    const values = [
      data.shipment_id,
      data.declaration_no,
      data.declaration_date,
      data.declarant_agent,
      data.customs_station,
      data.valuation_basis,
      data.currency,
      data.tariff_rate,
      data.duties_etb,
      data.payment_receipt_no,
      data.risk_score || 0,
      data.risk_channel || null,
      data.risk_reason || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query(`
      SELECT d.*, s.shipment_reference, i.company_name
      FROM declarations d
      JOIN shipments s ON d.shipment_id = s.shipment_id
      JOIN importers i ON s.importer_id = i.importer_id
      ORDER BY d.declaration_date DESC;
    `);
    return result.rows;
  },

  async setStatus({ id, status, reason }) {
    const result = await pool.query(
      `UPDATE declarations SET status=$2, status_reason=$3 WHERE declaration_id=$1 RETURNING *;`,
      [id, status, reason || null]
    );
    return result.rows[0] || null;
  },
};
