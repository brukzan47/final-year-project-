import { pool } from "../config/db.js";

export const Performance = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS performance (
        performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        importer_id UUID REFERENCES importers(importer_id) ON DELETE CASCADE,
        avg_clearance_time NUMERIC(5,2),
        number_of_queries INT,
        penalties VARCHAR(50),
        complaints VARCHAR(50),
        feedback_score NUMERIC(2,1),
        officer_responsible VARCHAR(80),
        notes TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
  },

  async create(data) {
    const query = `
      INSERT INTO performance
      (importer_id, avg_clearance_time, number_of_queries, penalties, complaints,
       feedback_score, officer_responsible, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING performance_id, avg_clearance_time;
    `;
    const values = [
      data.importer_id,
      data.avg_clearance_time,
      data.number_of_queries,
      data.penalties,
      data.complaints,
      data.feedback_score,
      data.officer_responsible,
      data.notes,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query(`
      SELECT p.*, i.company_name
      FROM performance p
      JOIN importers i ON p.importer_id = i.importer_id
      ORDER BY p.created_at DESC;
    `);
    return result.rows;
  },
};
