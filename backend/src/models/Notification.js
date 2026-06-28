import { pool } from "../config/db.js";

export const Notification = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'INFO',
        category VARCHAR(50) DEFAULT 'SYSTEM',
        reference_id UUID,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        channels TEXT[] DEFAULT ARRAY['IN_APP'],
        event_key VARCHAR(180),
        metadata JSONB,
        roles TEXT[] NOT NULL,
        importer_id UUID REFERENCES importers(importer_id),
        declaration_id UUID REFERENCES declarations(declaration_id),
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'INFO';");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'SYSTEM';");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['IN_APP'];");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key VARCHAR(180);");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS importer_id UUID REFERENCES importers(importer_id);");
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS declaration_id UUID REFERENCES declarations(declaration_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);");
    await pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_key_user ON notifications(user_id, event_key) WHERE event_key IS NOT NULL AND user_id IS NOT NULL;"
    );
  },

  async create(data) {
    const query = `
      INSERT INTO notifications (title, message, roles, importer_id, declaration_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING notification_id, title, message, roles, importer_id, declaration_id, created_at;
    `;
    const values = [data.title, data.message, data.roles, data.importer_id || null, data.declaration_id || null];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async createForUser(data) {
    const query = `
      INSERT INTO notifications
      (user_id, title, message, type, category, reference_id, is_read, channels, event_key, metadata, roles, importer_id, declaration_id)
      VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (user_id, event_key)
      WHERE event_key IS NOT NULL AND user_id IS NOT NULL
      DO NOTHING
      RETURNING
        notification_id AS id,
        user_id,
        title,
        message,
        type,
        category,
        reference_id,
        is_read AS read,
        created_at,
        roles,
        importer_id,
        declaration_id,
        channels,
        metadata;
    `;
    const values = [
      data.user_id,
      data.title,
      data.message,
      data.type || "INFO",
      data.category || "SYSTEM",
      data.reference_id || null,
      Array.isArray(data.channels) && data.channels.length ? data.channels : ["IN_APP"],
      data.event_key || null,
      data.metadata || null,
      Array.isArray(data.roles) && data.roles.length ? data.roles : ["SYSTEM"],
      data.importer_id || null,
      data.declaration_id || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  async getAll() {
    const result = await pool.query(
      `SELECT notification_id, title, message, roles, created_at
       FROM notifications
       ORDER BY created_at DESC`
    );
    return result.rows;
  },

  async listByUser(user_id, { limit = 50 } = {}) {
    const result = await pool.query(
      `SELECT
          notification_id AS id,
          user_id,
          title,
          message,
          type,
          category,
          reference_id,
          is_read AS read,
          created_at,
          channels,
          metadata
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [user_id, Number(limit) || 50]
    );
    return result.rows;
  },

  async countUnreadByUser(user_id) {
    const result = await pool.query(
      `SELECT COUNT(1)::INT AS unread_count
       FROM notifications
       WHERE user_id=$1 AND is_read=FALSE`,
      [user_id]
    );
    return Number(result.rows?.[0]?.unread_count || 0);
  },

  async markRead({ notification_id, user_id }) {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read=TRUE, read_at=now()
       WHERE notification_id=$1 AND user_id=$2
       RETURNING
         notification_id AS id,
         user_id,
         title,
         message,
         type,
         category,
         reference_id,
         is_read AS read,
         created_at`,
      [notification_id, user_id]
    );
    return result.rows[0] || null;
  },

  async markAllRead(user_id) {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read=TRUE, read_at=now()
       WHERE user_id=$1 AND is_read=FALSE`,
      [user_id]
    );
    return Number(result.rowCount || 0);
  },

  async getByRole(role) {
    const result = await pool.query(
      `SELECT notification_id, title, message, roles, created_at
      FROM notifications
       WHERE $1 = ANY(roles)
       ORDER BY created_at DESC`,
      [role]
    );
    return result.rows;
  },

  async getForUser({ role, importer_id }) {
    const result = await pool.query(
      `SELECT notification_id, title, message, roles, importer_id, declaration_id, created_at
       FROM notifications
       WHERE $1 = ANY(roles) AND (importer_id IS NULL OR importer_id = $2)
       ORDER BY created_at DESC`,
      [role, importer_id || null]
    );
    return result.rows;
  },
};
