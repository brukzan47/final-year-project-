import { pool } from "../config/db.js";

export const SmartIndex = {
  async createTable() {
    const q = `
      CREATE TABLE IF NOT EXISTS smart_index (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        text TEXT NOT NULL,
        embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(entity_type, entity_id)
      );
    `;
    await pool.query(q);
    await pool.query("CREATE INDEX IF NOT EXISTS smart_index_type_updated_idx ON smart_index(entity_type, updated_at DESC);");
  },

  async upsert({ entity_type, entity_id, text, embedding }) {
    const q = `
      INSERT INTO smart_index (entity_type, entity_id, text, embedding, updated_at)
      VALUES ($1,$2,$3,$4, now())
      ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, updated_at = now()
      RETURNING *;
    `;
    const r = await pool.query(q, [entity_type, entity_id, text, JSON.stringify(embedding || [])]);
    return r.rows[0];
  },

  // Naive similarity: shared token overlap (no real vector math for now)
  async search({ q, types = [], limit = 50 }) {
    const tokens = String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const typeCond = Array.isArray(types) && types.length ? `AND entity_type = ANY($2)` : '';
    const params = [ `%${tokens[0]}%` ];
    if (typeCond) params.push(types);
    const sql = `SELECT id, entity_type, entity_id, text FROM smart_index WHERE text ILIKE $1 ${typeCond} ORDER BY updated_at DESC LIMIT ${Number(limit)||50}`;
    const r = await pool.query(sql, params);
    // Rank by overlap count
    const rank = (t) => {
      const words = String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const set = new Set(words);
      let score = 0; for (const tok of tokens) if (set.has(tok)) score++;
      return score;
    };
    return r.rows.map(row => ({ ...row, score: rank(row.text) })).sort((a,b)=> b.score - a.score);
  },
};

