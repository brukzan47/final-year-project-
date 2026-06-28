import { pool } from "../config/db.js";

export const PaymentRefund = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        refund_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE SET NULL,
        amount NUMERIC(15,2) NOT NULL,
        reason VARCHAR(120) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Finance Review',
        requested_by VARCHAR(80),
        reviewed_by VARCHAR(80),
        gateway_ref VARCHAR(120),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await pool.query("ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE SET NULL;");
    await pool.query("ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS requested_by VARCHAR(80);");
    await pool.query("ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(80);");
    await pool.query("ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS gateway_ref VARCHAR(120);");
    await pool.query("ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS notes TEXT;");
  },

  async list() {
    const q = await pool.query(`
      SELECT
        r.*,
        p.total_payable,
        p.payment_method,
        p.receipt_no,
        p.transaction_id,
        d.declaration_no
      FROM payment_refunds r
      JOIN payments p ON r.payment_id = p.payment_id
      LEFT JOIN declarations d ON r.declaration_id = d.declaration_id
      ORDER BY r.created_at DESC
    `);
    return q.rows;
  },

  async create(data) {
    const q = await pool.query(
      `INSERT INTO payment_refunds
        (payment_id, declaration_id, amount, reason, status, requested_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.payment_id,
        data.declaration_id || null,
        data.amount,
        data.reason,
        data.status || "Finance Review",
        data.requested_by || null,
        data.notes || null,
      ]
    );
    return q.rows[0];
  },

  async updateStatus(id, fields) {
    const q = await pool.query(
      `UPDATE payment_refunds
          SET status=$2,
              reviewed_by=COALESCE($3, reviewed_by),
              gateway_ref=COALESCE($4, gateway_ref),
              notes=COALESCE($5, notes),
              updated_at=now()
        WHERE refund_id=$1
        RETURNING *`,
      [id, fields.status, fields.reviewed_by || null, fields.gateway_ref || null, fields.notes || null]
    );
    return q.rows[0] || null;
  },
};
