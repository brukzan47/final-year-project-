import { pool } from "../config/db.js";

export const Inspection = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS inspections (
        inspection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        risk_channel VARCHAR(10),
        inspection_date DATE,
        inspector_name VARCHAR(80),
        inspection_result VARCHAR(20),
        remarks TEXT,
        release_reference VARCHAR(30),
        release_date DATE,
        storage_days NUMERIC(5,2),
        supervisor_approved BOOLEAN DEFAULT FALSE,
        supervisor_reason TEXT,
        override_reason TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_approved BOOLEAN DEFAULT FALSE;");
    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_reason TEXT;");
    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS override_reason TEXT;");
  },

  async create(data) {
    const query = `
      INSERT INTO inspections
      (declaration_id, risk_channel, inspection_date, inspector_name,
       inspection_result, remarks, release_reference, release_date, storage_days,
       supervisor_approved, supervisor_reason, override_reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING inspection_id, inspection_result, inspector_name, risk_channel;
    `;
    const values = [
      data.declaration_id,
      data.risk_channel,
      data.inspection_date,
      data.inspector_name,
      data.inspection_result,
      data.remarks,
      data.release_reference,
      data.release_date,
      data.storage_days,
      !!data.supervisor_approved,
      data.supervisor_reason || null,
      data.override_reason || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query(`
      SELECT i.*, d.declaration_no
      FROM inspections i
      JOIN declarations d ON i.declaration_id = d.declaration_id
      ORDER BY i.inspection_date DESC;
    `);
    return result.rows;
  },
};
