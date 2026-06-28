import { pool } from "../config/db.js";

export const ReportSchedule = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        recipient_email VARCHAR(160) NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        send_time VARCHAR(5) NOT NULL DEFAULT '08:00',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled ON report_schedules(enabled);");
  },

  async list() {
    const r = await pool.query(
      `SELECT schedule_id, created_by, recipient_email, frequency, send_time, enabled, last_sent_at, created_at, updated_at
       FROM report_schedules
       ORDER BY created_at DESC`
    );
    return r.rows;
  },

  async upsert({ schedule_id = null, created_by = null, recipient_email, frequency = "daily", send_time = "08:00", enabled = true }) {
    if (schedule_id) {
      const r = await pool.query(
        `UPDATE report_schedules
         SET recipient_email=$2, frequency=$3, send_time=$4, enabled=$5, updated_at=now()
         WHERE schedule_id=$1
         RETURNING *`,
        [schedule_id, recipient_email, frequency, send_time, !!enabled]
      );
      return r.rows[0] || null;
    }
    const r = await pool.query(
      `INSERT INTO report_schedules (created_by, recipient_email, frequency, send_time, enabled)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [created_by, recipient_email, frequency, send_time, !!enabled]
    );
    return r.rows[0];
  },

  async remove(schedule_id) {
    const r = await pool.query("DELETE FROM report_schedules WHERE schedule_id=$1", [schedule_id]);
    return Number(r.rowCount || 0);
  },

  async markSent(schedule_id) {
    await pool.query("UPDATE report_schedules SET last_sent_at=now(), updated_at=now() WHERE schedule_id=$1", [schedule_id]);
  },
};

