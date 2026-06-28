import { pool } from "../config/db.js";

export const AuditLog = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id BIGSERIAL PRIMARY KEY,
        actor_user_id UUID REFERENCES users(user_id),
        actor_role VARCHAR(80),
        action VARCHAR(80) NOT NULL,
        entity_type VARCHAR(80),
        entity_id TEXT,
        ip_address VARCHAR(80),
        reason TEXT,
        before_value JSONB,
        after_value JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);");
  },

  async record({ req, action, entityType, entityId, reason = null, before = null, after = null, metadata = null }) {
    await pool.query(
      `INSERT INTO audit_logs
       (actor_user_id, actor_role, action, entity_type, entity_id, ip_address, reason, before_value, after_value, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        req?.user?.id || null,
        req?.user?.role || null,
        action,
        entityType || null,
        entityId ? String(entityId) : null,
        req?.ip || req?.socket?.remoteAddress || null,
        reason,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  },
};
