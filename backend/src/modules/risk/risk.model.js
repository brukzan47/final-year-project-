import { pool } from "../../config/db.js";

export const RiskModel = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS risk_scores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        risk_score INT NOT NULL,
        channel VARCHAR(20) NOT NULL,
        reasons JSONB,
        model_version TEXT,
        features JSONB,
        decided_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await pool.query("CREATE INDEX IF NOT EXISTS idx_risk_scores_decl ON risk_scores(declaration_id);");

    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_channel VARCHAR(20);");
    await pool.query("ALTER TABLE declarations ADD COLUMN IF NOT EXISTS risk_reason TEXT;");

    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_approved BOOLEAN DEFAULT FALSE;");
    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS supervisor_reason TEXT;");
    await pool.query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS override_reason TEXT;");
  },

  async recordRiskDecision({ declarationId, score, channel, reasons, modelVersion = "phase1-rule-ai", features = {} }) {
    await pool.query(
      `INSERT INTO risk_scores (declaration_id, risk_score, channel, reasons, model_version, features)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb)`,
      [
        declarationId,
        Math.max(0, Math.min(100, Number(score) || 0)),
        channel,
        JSON.stringify(reasons || []),
        modelVersion,
        JSON.stringify(features || {}),
      ]
    );
  },
};
