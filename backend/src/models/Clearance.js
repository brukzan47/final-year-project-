import { pool } from "../config/db.js";
import { createUniqueIndexIfClean } from "../utils/dbInit.js";

export const Clearance = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS clearances (
        clearance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        release_date DATE,
        officer_name VARCHAR(80),
        customs_office VARCHAR(80),
        delivery_note_no VARCHAR(40),
        transport_company VARCHAR(100),
        truck_plate_no VARCHAR(20),
        destination_address TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await createUniqueIndexIfClean(
      "idx_clearances_declaration_unique",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_clearances_declaration_unique ON clearances(declaration_id);"
    );
  },

  async create(data) {
    const client = await pool.connect();
    const query = `
      INSERT INTO clearances
      (declaration_id, release_date, officer_name, customs_office,
       delivery_note_no, transport_company, truck_plate_no, destination_address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING clearance_id, declaration_id, release_date, officer_name, customs_office, delivery_note_no;
    `;
    const values = [
      data.declaration_id,
      data.release_date,
      data.officer_name,
      data.customs_office,
      data.delivery_note_no,
      data.transport_company,
      data.truck_plate_no,
      data.destination_address,
    ];
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`clearance_declaration:${data.declaration_id}`]);
      const duplicate = await client.query(
        "SELECT clearance_id FROM clearances WHERE declaration_id=$1 LIMIT 1",
        [data.declaration_id]
      );
      if (duplicate.rowCount) {
        const error = new Error("Clearance already exists for this declaration");
        error.code = "23505";
        throw error;
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
      SELECT c.*, d.declaration_no
      FROM clearances c
      JOIN declarations d ON c.declaration_id = d.declaration_id
      ORDER BY c.release_date DESC, c.created_at DESC;
    `);
    return result.rows;
  },
};
