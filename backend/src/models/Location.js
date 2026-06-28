import { pool } from "../config/db.js";

export const Location = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        name TEXT PRIMARY KEY,
        lat NUMERIC NOT NULL,
        lon NUMERIC NOT NULL
      );
    `);
    // Ensure optional 'type' column and a CHECK constraint for allowed values
    try {
      await pool.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS type VARCHAR(30)`);
    } catch {}
    try {
      const q = await pool.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname = 'locations_type_check'
          AND conrelid = 'locations'::regclass
      `);
      if (q.rowCount === 0) {
        await pool.query(`ALTER TABLE locations ADD CONSTRAINT locations_type_check CHECK (type IN ('port','dry_port','border','city') OR type IS NULL)`);
      }
    } catch {}
    // Seed a few known ports/airports if table is empty
    try {
      const r = await pool.query(`SELECT COUNT(1) AS cnt FROM locations`);
      const cnt = Number(r.rows[0]?.cnt || 0);
      if (cnt === 0) {
        const rows = [
          { name: 'Modjo Dry Port', type: 'dry_port', lat: 8.5866, lon: 39.1189 },
          { name: 'Kality Dry Port', type: 'dry_port', lat: 8.9445, lon: 38.7817 },
          { name: 'Gelan Dry Port', type: 'dry_port', lat: 8.8429, lon: 38.9036 },
          { name: 'Dire Dawa Dry Port', type: 'dry_port', lat: 9.6000, lon: 41.8661 },
          { name: 'Kombolcha Dry Port', type: 'dry_port', lat: 11.0810, lon: 39.7410 },
          { name: 'Semera Dry Port', type: 'dry_port', lat: 11.7952, lon: 41.0082 },
          { name: 'Mekelle Dry Port', type: 'dry_port', lat: 13.4967, lon: 39.4753 },
          { name: 'Addis Ababa Bole Intl. Airport', type: 'port', lat: 8.9779, lon: 38.7993 },
          { name: 'Djibouti Port', type: 'port', lat: 11.6000, lon: 43.1500 },
        ];
        for (const row of rows) {
          try {
            await pool.query(`INSERT INTO locations (name, type, lat, lon) VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO NOTHING`, [row.name, row.type || null, row.lat, row.lon]);
          } catch {}
        }
      }
    } catch {}
  },
};
