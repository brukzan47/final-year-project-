import { pool } from "../config/db.js";

export const CurrencyApproval = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS currency_approvals (
        approval_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        request_ref TEXT UNIQUE,
        currency TEXT,
        amount_usd NUMERIC,
        status TEXT,
        approved_at TIMESTAMP NULL,
        rejected_reason TEXT NULL,
        raw JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_currency_approvals_decl ON currency_approvals(declaration_id);");
  },
};

