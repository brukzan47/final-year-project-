-- Enterprise payment hardening:
-- - canonical statuses
-- - approval metadata
-- - active payment uniqueness
-- - immutable audit and callback ledgers

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Normalize legacy/dirty statuses into canonical set
UPDATE payments
SET payment_status = CASE
  WHEN payment_status IS NULL OR btrim(payment_status) = '' THEN 'Pending'
  WHEN lower(btrim(payment_status)) IN ('pending', 'verifying') THEN 'Pending'
  WHEN lower(btrim(payment_status)) IN ('verified') THEN 'Verified'
  WHEN lower(btrim(payment_status)) IN ('resolved', 'paid') THEN 'Paid'
  WHEN lower(btrim(payment_status)) IN ('failed', 'reversed') THEN 'Failed'
  ELSE 'Pending'
END;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_status_check
  CHECK (payment_status IN ('Pending','Failed','Verified','Paid'));

-- Keep only one active payment row per declaration before unique index
WITH ranked AS (
  SELECT payment_id,
         declaration_id,
         payment_status,
         ROW_NUMBER() OVER (
           PARTITION BY declaration_id
           ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, payment_id DESC
         ) AS rn
  FROM payments
  WHERE payment_status IN ('Pending', 'Verified')
)
UPDATE payments p
SET payment_status='Failed',
    updated_at=now()
FROM ranked r
WHERE p.payment_id = r.payment_id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_decl_active
ON payments(declaration_id)
WHERE payment_status IN ('Pending','Verified');

CREATE TABLE IF NOT EXISTS payment_events (
  event_id BIGSERIAL PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  actor VARCHAR(80),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callbacks_provider_txn
ON payment_callbacks(provider, external_txn_id);
