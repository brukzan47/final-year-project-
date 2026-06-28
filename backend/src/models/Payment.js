import { pool } from "../config/db.js";

export const Payment = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS payments (
        payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
        invoice_value_usd NUMERIC(15,2),
        exchange_rate NUMERIC(10,4),
        cif_etb NUMERIC(15,2),
        duty_paid NUMERIC(15,2),
        vat_paid NUMERIC(15,2),
        excise_paid NUMERIC(15,2),
        total_payable NUMERIC(15,2),
        receipt_no VARCHAR(40),
        payment_method VARCHAR(50),
        payment_status VARCHAR(20),
        payment_order_no VARCHAR(50),
        bank_name VARCHAR(80),
        transaction_id VARCHAR(80),
        paid_amount NUMERIC(15,2),
        currency VARCHAR(8),
        verified_by VARCHAR(80),
        verified_at TIMESTAMP,
        failure_reason VARCHAR(30),
        paid BOOLEAN DEFAULT FALSE,
        payment_date DATE,
        approved_by UUID REFERENCES users(user_id),
        approved_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    // Ensure column exists for existing databases
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS cif_etb NUMERIC(15,2);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(40);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_order_no VARCHAR(50);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name VARCHAR(80);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(80);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(8);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by VARCHAR(80);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(30);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id);");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();");
    await pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_decl_verified ON payments(declaration_id) WHERE payment_status = 'Verified';"
    );
    await pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_decl_active ON payments(declaration_id) WHERE payment_status IN ('Pending','Verified');"
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id BIGSERIAL PRIMARY KEY,
        payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
        event_type VARCHAR(40) NOT NULL,
        actor VARCHAR(80),
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_callbacks (
        callback_id BIGSERIAL PRIMARY KEY,
        provider VARCHAR(30) NOT NULL,
        external_txn_id VARCHAR(120),
        payment_order_no VARCHAR(60),
        raw_payload JSONB NOT NULL,
        signature_valid BOOLEAN NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callbacks_provider_txn ON payment_callbacks(provider, external_txn_id);"
    );
  },

  async create(data) {
    const query = `
      INSERT INTO payments
      (declaration_id, invoice_value_usd, exchange_rate, cif_etb, duty_paid, vat_paid,
       excise_paid, total_payable, receipt_no, payment_method, payment_status, payment_date,
       payment_order_no)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *;
    `;
    const values = [
      data.declaration_id,
      data.invoice_value_usd,
      data.exchange_rate,
      data.cif_etb,
      data.duty_paid,
      data.vat_paid,
      data.excise_paid,
      data.total_payable,
      data.receipt_no,
      data.payment_method,
      data.payment_status,
      data.payment_date,
      data.payment_order_no,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query(`
      SELECT p.*, d.declaration_no
      FROM payments p
      JOIN declarations d ON p.declaration_id = d.declaration_id
      ORDER BY p.payment_date DESC;
    `);
    return result.rows;
  },

  async getById(id) {
    const q = await pool.query(
      `SELECT p.*, d.declaration_no, d.currency AS declaration_currency
       FROM payments p
       JOIN declarations d ON p.declaration_id = d.declaration_id
       WHERE p.payment_id=$1`,
      [id]
    );
    return q.rows[0] || null;
  },

  async appendEvent(payment_id, event_type, actor = null, payload = null, client = null) {
    const c = client || pool;
    try {
      await c.query(
        `INSERT INTO payment_events (payment_id, event_type, actor, payload, created_at)
         VALUES ($1,$2,$3,$4, now())`,
        [payment_id, event_type, actor, payload ? JSON.stringify(payload) : null]
      );
    } catch (err) {
      try { console.error("payment.appendEvent failed", err?.message || err); } catch {}
    }
  },

  async findByPaymentOrderNo(orderNo) {
    const q = await pool.query(`SELECT * FROM payments WHERE payment_order_no=$1 LIMIT 1`, [orderNo]);
    return q.rows[0] || null;
  },

  async updateFields(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return await this.getById(id);
    const set = keys.map((k, i) => `${k}=$${i + 2}`).join(", ");
    const values = [id, ...keys.map((k) => fields[k])];
    const q = await pool.query(
      `UPDATE payments SET ${set}, updated_at=now() WHERE payment_id=$1 RETURNING *`,
      values
    );
    return q.rows[0] || null;
  },
};
