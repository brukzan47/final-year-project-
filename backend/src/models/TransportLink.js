import { pool } from "../config/db.js";

export const TransportLink = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS transport_links (
        link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        provider TEXT,
        provider_ref TEXT UNIQUE,
        status TEXT,
        raw JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_transport_links_ship ON transport_links(shipment_id);");
  },
};

