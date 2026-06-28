import { pool } from "../config/db.js";

export const PaymentIntent = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS payment_intents (
        intent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        amount_etb NUMERIC(15,2) NOT NULL,
        provider VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        provider_ref VARCHAR(80),
        receipt_no VARCHAR(40),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_payment_intents_decl ON payment_intents(declaration_id);");
  },

  async create({ declaration_id, amount_etb, provider, metadata }) {
    const res = await pool.query(
      `INSERT INTO payment_intents (declaration_id, amount_etb, provider, metadata)
       VALUES ($1,$2,$3,$4)
       RETURNING intent_id, declaration_id, amount_etb, provider, status, created_at`,
      [declaration_id, amount_etb, provider, metadata || null]
    );
    return res.rows[0];
  },

  async getById(intent_id) {
    const r = await pool.query("SELECT * FROM payment_intents WHERE intent_id=$1", [intent_id]);
    return r.rowCount ? r.rows[0] : null;
  },

  async setStatus(intent_id, status, { provider_ref = null, receipt_no = null } = {}) {
    const r = await pool.query(
      `UPDATE payment_intents
       SET status=$2, provider_ref=COALESCE($3, provider_ref), receipt_no=COALESCE($4, receipt_no), updated_at=now()
       WHERE intent_id=$1 RETURNING *`,
      [intent_id, status, provider_ref, receipt_no]
    );
    return r.rowCount ? r.rows[0] : null;
  },
};

