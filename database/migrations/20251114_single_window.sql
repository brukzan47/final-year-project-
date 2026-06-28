-- Single Window Integration: NBE FX approvals, Trade Permits, Transport Links/Events
-- Idempotent-ish creation using IF NOT EXISTS where available

-- Currency Approvals (NBE)
CREATE TABLE IF NOT EXISTS currency_approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  request_ref TEXT UNIQUE,
  currency TEXT,
  amount_usd NUMERIC,
  status TEXT, -- Pending | Approved | Rejected | Error
  approved_at TIMESTAMP NULL,
  rejected_reason TEXT NULL,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS currency_approvals_decl_idx ON currency_approvals(declaration_id);

-- Import Permits (Ministry of Trade)
CREATE TABLE IF NOT EXISTS import_permits (
  permit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES declarations(declaration_id) ON DELETE CASCADE,
  permit_no TEXT UNIQUE,
  hs_code TEXT[] DEFAULT '{}',
  qty NUMERIC NULL,
  value_usd NUMERIC NULL,
  status TEXT, -- Pending | Issued | Rejected | Expired | Error
  issued_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_permits_decl_idx ON import_permits(declaration_id);

-- Transport Linkage (Transport Ministry)
CREATE TABLE IF NOT EXISTS transport_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  provider TEXT,
  provider_ref TEXT UNIQUE,
  status TEXT, -- Linked | Inactive | Error
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transport_links_ship_idx ON transport_links(shipment_id);

-- Transport Events stream (optional)
CREATE TABLE IF NOT EXISTS transport_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES transport_links(link_id) ON DELETE CASCADE,
  ts TIMESTAMP NOT NULL DEFAULT now(),
  event_type TEXT,
  lat NUMERIC NULL,
  lon NUMERIC NULL,
  raw JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS transport_events_link_idx ON transport_events(link_id, ts DESC);

