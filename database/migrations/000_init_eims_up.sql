-- database/migrations/000_init_eims_up.sql

-- EIMS initial migration (UP)
-- Uses pgcrypto gen_random_uuid() for UUID generation

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUM types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'declaration_status') THEN
    CREATE TYPE declaration_status AS ENUM ('draft','submitted','reviewed','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending','paid','failed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
    CREATE TYPE inspection_status AS ENUM ('scheduled','in_progress','completed','cancelled');
  END IF;
END$$;

-- users table (if an existing users table exists, this will be non-destructive)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RBAC tables
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Importers
CREATE TABLE IF NOT EXISTS importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importer_id VARCHAR(64) UNIQUE NOT NULL,
  tin_number VARCHAR(64) UNIQUE,
  importer_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  import_license_number VARCHAR(128),
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(100),
  address TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_importers_name_trgm ON importers USING gin (importer_name gin_trgm_ops);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number VARCHAR(128) UNIQUE NOT NULL,
  importer_id UUID REFERENCES importers(id) ON DELETE SET NULL,
  country_of_origin VARCHAR(100),
  port_of_entry VARCHAR(255),
  arrival_date DATE,
  container_number VARCHAR(128),
  transport_mode VARCHAR(50),
  goods_category TEXT,
  hs_code VARCHAR(20),
  shipment_status VARCHAR(50) DEFAULT 'pending',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_hs_code ON shipments (hs_code);
CREATE INDEX IF NOT EXISTS idx_shipments_arrival ON shipments (arrival_date);

-- Declarations
CREATE TABLE IF NOT EXISTS declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_number VARCHAR(128) UNIQUE NOT NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  importer_id UUID REFERENCES importers(id) ON DELETE SET NULL,
  declaration_date DATE,
  goods_description TEXT,
  declared_value NUMERIC(14,2),
  quantity NUMERIC(14,4),
  duty_amount NUMERIC(14,2),
  vat_amount NUMERIC(14,2),
  status declaration_status DEFAULT 'draft',
  risk_score INTEGER,
  risk_factors JSONB,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES users(id),
  reviewed_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NULL,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);
CREATE INDEX IF NOT EXISTS idx_declarations_goods_trgm ON declarations USING gin (goods_description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_declarations_risk_score ON declarations (risk_score);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  importer_id UUID REFERENCES importers(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  filename VARCHAR(512) NOT NULL,
  filepath VARCHAR(1024) NOT NULL,
  mimetype VARCHAR(100),
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  checksum VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm ON documents USING gin (filename gin_trgm_ops);

-- Risk assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID UNIQUE REFERENCES declarations(id) ON DELETE CASCADE,
  risk_score INTEGER,
  risk_level VARCHAR(20),
  risk_factors JSONB,
  recommendation TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculated_by UUID REFERENCES users(id)
);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_number VARCHAR(128) UNIQUE,
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id),
  scheduled_at TIMESTAMPTZ,
  assigned_inspector_id UUID REFERENCES users(id),
  status inspection_status DEFAULT 'scheduled',
  report JSONB,
  result VARCHAR(20),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id),
  amount NUMERIC(14,2),
  payment_type VARCHAR(50),
  payment_reference VARCHAR(255) UNIQUE,
  bank_confirmation JSONB,
  payment_status payment_status DEFAULT 'pending',
  paid_at TIMESTAMPTZ NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

-- Clearance certificates
CREATE TABLE IF NOT EXISTS clearance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number VARCHAR(128) UNIQUE NOT NULL,
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  issue_date TIMESTAMPTZ DEFAULT now(),
  issued_by UUID REFERENCES users(id),
  qr_code_data TEXT,
  pdf_path VARCHAR(1024),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES users(id),
  channel VARCHAR(20),
  title VARCHAR(255),
  body TEXT,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(1024),
  filepath VARCHAR(1024),
  size_bytes BIGINT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- HS codes and Ports
CREATE TABLE IF NOT EXISTS hs_codes (
  code VARCHAR(20) PRIMARY KEY,
  description TEXT,
  duty_rates JSONB
);

CREATE TABLE IF NOT EXISTS ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  country VARCHAR(100),
  code VARCHAR(50)
);

-- GIN extension prerequisites: ensure pg_trgm is available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Done

