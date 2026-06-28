-- Reference prices by HS code and origin (optional but useful)
CREATE TABLE IF NOT EXISTS reference_prices (
  hs_code VARCHAR(20) NOT NULL,
  origin_country VARCHAR(100) NOT NULL DEFAULT '',
  unit_of_measure VARCHAR(10) NOT NULL DEFAULT '',
  p50_value_usd NUMERIC(15,2),
  p80_value_usd NUMERIC(15,2),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (hs_code, origin_country, unit_of_measure)
);

