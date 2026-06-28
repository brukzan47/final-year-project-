import { pool } from "../config/db.js";
import { createUniqueIndexIfClean } from "../utils/dbInit.js";

export const Importer = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS importers (
        importer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_name VARCHAR(120) NOT NULL,
        tin_number VARCHAR(20) UNIQUE NOT NULL,
        customs_registration_no VARCHAR(40),
        contact_person VARCHAR(80),
        contact_title VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(80),
        import_license_no VARCHAR(40),
        sector_type VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    // Ensure uniqueness on customs_registration_no when present
    await createUniqueIndexIfClean(
      "idx_importers_customs_reg_no",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_importers_customs_reg_no ON importers(customs_registration_no) WHERE customs_registration_no IS NOT NULL AND BTRIM(customs_registration_no) <> '';"
    );
  },

  async create(data) {
    const query = `
      INSERT INTO importers
      (company_name, tin_number, customs_registration_no, contact_person,
       contact_title, contact_phone, contact_email, import_license_no,
       sector_type, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING importer_id, company_name, tin_number;
    `;
    const values = [
      data.company_name,
      data.tin_number,
      String(data.customs_registration_no || "").trim() || null,
      data.contact_person,
      data.contact_title,
      data.contact_phone,
      data.contact_email,
      data.import_license_no,
      data.sector_type,
      data.address,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query("SELECT * FROM importers ORDER BY created_at DESC;");
    return result.rows;
  },
};
