-- GPS devices registry
CREATE TABLE IF NOT EXISTS gps_devices (
  device_id VARCHAR(80) PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE SET NULL,
  container_no VARCHAR(20),
  transport_company VARCHAR(120),
  driver_name VARCHAR(120),
  driver_phone VARCHAR(30),
  active BOOLEAN DEFAULT TRUE,
  registered_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gps_devices_container ON gps_devices(container_no);

-- Known locations (ports, dry ports, borders) for proximity / alerts
CREATE TABLE IF NOT EXISTS locations (
  location_id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  type VARCHAR(30), -- port | dry_port | border | city
  lat NUMERIC(9,6) NOT NULL,
  lon NUMERIC(9,6) NOT NULL
);

-- Seed common ports if not present
INSERT INTO locations(name, type, lat, lon)
  VALUES
  ('Djibouti Port','port',11.600000,43.150000),
  ('Modjo Dry Port','dry_port',8.586000,39.125000),
  ('Kality Dry Port','dry_port',8.935000,38.775000),
  ('Gelan Dry Port','dry_port',8.847000,38.936000),
  ('Addis Ababa Bole Intl. Airport','port',8.977000,38.799000),
  ('Dire Dawa Dry Port','dry_port',9.596000,41.866000),
  ('Kombolcha Dry Port','dry_port',11.084000,39.733000),
  ('Semera Dry Port','dry_port',11.793000,41.005000),
  ('Mekelle Dry Port','dry_port',13.502000,39.491000)
ON CONFLICT (name) DO NOTHING;

