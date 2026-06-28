import { pool } from "../config/db.js";

export const Document = {
  async createTable() {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS documents (
        document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE SET NULL,
        title VARCHAR(120),
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        uploaded_by UUID REFERENCES users(user_id),
        uploaded_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(createQuery);

    // Non-breaking schema upgrades
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS blockchain_tx TEXT;`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS blockchain_network TEXT;`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(32);`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS blockchain_anchored_at TIMESTAMP;`
    );
    await pool.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE SET NULL;`
    );
  },

  async create({
    declaration_id,
    shipment_id,
    title,
    file_name,
    file_path,
    file_type,
    file_size,
    uploaded_by,
    file_hash,
    blockchain_hash,
    blockchain_tx,
    blockchain_network,
    blockchain_status,
    blockchain_anchored_at,
  }) {
    const query = `
      INSERT INTO documents
        (declaration_id, shipment_id, title, file_name, file_path, file_type, file_size, uploaded_by,
         file_hash, blockchain_hash, blockchain_tx, blockchain_network, blockchain_status, blockchain_anchored_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING document_id, title, file_name, file_path, file_type, file_size, uploaded_at,
                file_hash, blockchain_status, blockchain_tx, blockchain_network, blockchain_anchored_at, shipment_id, declaration_id;
    `;
    const values = [
      declaration_id || null,
      shipment_id || null,
      title || null,
      file_name,
      file_path,
      file_type || null,
      file_size || null,
      uploaded_by || null,
      file_hash || null,
      blockchain_hash || null,
      blockchain_tx || null,
      blockchain_network || null,
      blockchain_status || null,
      blockchain_anchored_at || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll({ declaration_id } = {}) {
    if (declaration_id) {
      const result = await pool.query(
        `SELECT * FROM documents WHERE declaration_id = $1 ORDER BY uploaded_at DESC;`,
        [declaration_id]
      );
      return result.rows;
    }
    const result = await pool.query(
      `SELECT * FROM documents ORDER BY uploaded_at DESC;`
    );
    return result.rows;
  },

  async getById(id) {
    const result = await pool.query(
      `SELECT * FROM documents WHERE document_id = $1;`,
      [id]
    );
    return result.rows[0];
  },

  async findByHash(hash) {
    const result = await pool.query(
      `SELECT * FROM documents WHERE file_hash = $1 OR blockchain_hash = $1 ORDER BY uploaded_at DESC;`,
      [hash]
    );
    return result.rows;
  },

  async delete(id) {
    const result = await pool.query(
      `DELETE FROM documents WHERE document_id = $1 RETURNING *;`,
      [id]
    );
    return result.rows[0];
  },

  async setAnchored(id, { blockchain_hash, blockchain_tx, blockchain_network, status }) {
    const result = await pool.query(
      `UPDATE documents
       SET blockchain_hash = $1,
           blockchain_tx = $2,
           blockchain_network = $3,
           blockchain_status = $4,
           blockchain_anchored_at = now()
       WHERE document_id = $5
       RETURNING *;`,
      [blockchain_hash || null, blockchain_tx || null, blockchain_network || null, status || 'anchored', id]
    );
    return result.rows[0];
  },

  async updateFileHash(id, file_hash) {
    const result = await pool.query(
      `UPDATE documents SET file_hash = $1 WHERE document_id = $2 RETURNING *;`,
      [file_hash || null, id]
    );
    return result.rows[0];
  },

  async linkToShipment({ shipment_id, document_ids = [] }) {
    if (!shipment_id || !Array.isArray(document_ids) || document_ids.length === 0) return [];
    const result = await pool.query(
      `UPDATE documents
         SET shipment_id = $1
       WHERE document_id = ANY($2::uuid[])
       RETURNING document_id, shipment_id, declaration_id`,
      [shipment_id, document_ids]
    );
    return result.rows || [];
  },
};
