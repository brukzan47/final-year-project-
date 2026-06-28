import { pool } from "../config/db.js";

export const OcrExtract = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS ocr_extracts (
        extract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
        fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS ocr_extracts_doc_idx ON ocr_extracts(document_id);");
  },

  async insert({ document_id, fields, confidence }) {
    const r = await pool.query(
      `INSERT INTO ocr_extracts (document_id, fields, confidence) VALUES ($1,$2,$3) RETURNING *`,
      [document_id, JSON.stringify(fields || {}), JSON.stringify(confidence || {})]
    );
    return r.rows[0];
  },

  async listByDocument(document_id) {
    const r = await pool.query(`SELECT * FROM ocr_extracts WHERE document_id=$1 ORDER BY created_at DESC`, [document_id]);
    return r.rows;
  },
};

