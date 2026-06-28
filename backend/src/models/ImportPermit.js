import { pool } from "../config/db.js";

export const ImportPermit = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS import_permits (
        permit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        permit_no TEXT UNIQUE,
        hs_code TEXT[] DEFAULT '{}',
        qty NUMERIC NULL,
        value_usd NUMERIC NULL,
        status TEXT,
        issued_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        raw JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_import_permits_decl ON import_permits(declaration_id);");
  },
};

