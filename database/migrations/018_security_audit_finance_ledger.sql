BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS payment_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  reference_key VARCHAR(120) NOT NULL UNIQUE,
  payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
  refund_id UUID REFERENCES payment_refunds(refund_id) ON DELETE SET NULL,
  declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE SET NULL,
  entry_type VARCHAR(40) NOT NULL,
  debit_etb NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_etb NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'ETB',
  description TEXT,
  created_by VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_declaration
  ON payment_ledger(declaration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_type
  ON payment_ledger(entry_type, created_at DESC);

COMMIT;
