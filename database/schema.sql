-- database/schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =======================================
-- 1. ROLES
-- =======================================
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

-- =======================================
-- 2. USERS
-- =======================================
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(100) NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INT REFERENCES roles(role_id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 3. IMPORTERS
-- =======================================
CREATE TABLE IF NOT EXISTS importers (
  importer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(120) NOT NULL,
  tin_number VARCHAR(20) UNIQUE NOT NULL,
  customs_registration_no VARCHAR(40),
  contact_person VARCHAR(80),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  import_license_no VARCHAR(40),
  sector_type VARCHAR(50),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 4. SHIPMENTS
-- =======================================
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  importer_id UUID REFERENCES importers(importer_id) ON DELETE CASCADE,
  shipment_reference VARCHAR(50),
  description_of_goods TEXT,
  hs_code VARCHAR(20),
  quantity NUMERIC(10,2),
  unit_of_measure VARCHAR(10),
  cif_value_usd NUMERIC(15,2),
  origin_country VARCHAR(100),
  destination_port VARCHAR(100),
  mode_of_transport VARCHAR(30),
  arrival_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 5. DECLARATIONS
-- =======================================
CREATE TABLE IF NOT EXISTS declarations (
  declaration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  declaration_no VARCHAR(50) UNIQUE,
  declaration_date DATE,
  declarant_agent VARCHAR(100),
  customs_station VARCHAR(100),
  valuation_basis VARCHAR(10),
  currency VARCHAR(10),
  tariff_rate NUMERIC(5,2),
  duties_etb NUMERIC(15,2),
  payment_receipt_no VARCHAR(50),
  risk_score INTEGER DEFAULT 0,
  risk_channel VARCHAR(20),
  risk_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 6. INSPECTIONS
-- =======================================
CREATE TABLE IF NOT EXISTS inspections (
  inspection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  risk_channel VARCHAR(10),
  inspection_date DATE,
  inspector_name VARCHAR(100),
  inspection_result VARCHAR(30),
  remarks TEXT,
  release_reference VARCHAR(50),
  release_date DATE,
  storage_days INT,
  supervisor_approved BOOLEAN DEFAULT FALSE,
  supervisor_reason TEXT,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 7. PAYMENTS
-- =======================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  invoice_value_usd NUMERIC(15,2) NOT NULL,
  exchange_rate NUMERIC(10,4) NOT NULL,
  duty_paid NUMERIC(15,2) NOT NULL,
  vat_paid NUMERIC(15,2) NOT NULL,
  excise_paid NUMERIC(15,2) DEFAULT 0,
  total_payable NUMERIC(15,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'Pending',
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 8. CLEARANCES
-- =======================================
CREATE TABLE IF NOT EXISTS clearances (
  clearance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  release_date DATE,
  officer_name VARCHAR(100),
  customs_office VARCHAR(100),
  delivery_note_no VARCHAR(50),
  transport_company VARCHAR(100),
  truck_plate_no VARCHAR(20),
  destination_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================
-- 9. PERFORMANCE
-- =======================================
CREATE TABLE IF NOT EXISTS performance (
  performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  importer_id UUID REFERENCES importers(importer_id) ON DELETE CASCADE,
  avg_clearance_time INT,
  number_of_queries INT,
  penalties TEXT,
  complaints TEXT,
  feedback_score NUMERIC(3,1),
  officer_responsible VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

