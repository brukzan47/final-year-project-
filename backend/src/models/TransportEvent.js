import { pool } from "../config/db.js";

export const TransportEvent = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS transport_events (
        event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        link_id UUID REFERENCES transport_links(link_id) ON DELETE CASCADE,
        ts TIMESTAMP NOT NULL DEFAULT now(),
        event_type TEXT,
        lat NUMERIC NULL,
        lon NUMERIC NULL,
        raw JSONB DEFAULT '{}'::jsonb
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_transport_events_link ON transport_events(link_id, ts DESC);");
  },
};

