-- Enable trigram extension for fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Shipments
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_shipments_ref ON shipments(shipment_reference);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_ref ON shipments(tracking_ref);
CREATE INDEX IF NOT EXISTS idx_shipments_ref_trgm ON shipments USING gin (shipment_reference gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_ref_trgm ON shipments USING gin (tracking_ref gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_desc_trgm ON shipments USING gin (description_of_goods gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_hs_trgm ON shipments USING gin (hs_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_origin_trgm ON shipments USING gin (origin_country gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_destination_trgm ON shipments USING gin (destination_port gin_trgm_ops);

-- Declarations
CREATE INDEX IF NOT EXISTS idx_declarations_created_at ON declarations(created_at);
CREATE INDEX IF NOT EXISTS idx_declarations_no ON declarations(declaration_no);
CREATE INDEX IF NOT EXISTS idx_declarations_no_trgm ON declarations USING gin (declaration_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_declarations_status_trgm ON declarations USING gin (status gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_declarations_station_trgm ON declarations USING gin (customs_station gin_trgm_ops);

-- Importers
CREATE INDEX IF NOT EXISTS idx_importers_created_at ON importers(created_at);
CREATE INDEX IF NOT EXISTS idx_importers_name ON importers(company_name);
CREATE INDEX IF NOT EXISTS idx_importers_tin ON importers(tin_number);
CREATE INDEX IF NOT EXISTS idx_importers_name_trgm ON importers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_importers_tin_trgm ON importers USING gin (tin_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_importers_email_trgm ON importers USING gin (contact_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_importers_phone_trgm ON importers USING gin (contact_phone gin_trgm_ops);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_file_name_trgm ON documents USING gin (file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_file_type_trgm ON documents USING gin (file_type gin_trgm_ops);

-- GPS Devices
CREATE INDEX IF NOT EXISTS idx_gps_devices_registered_at ON gps_devices(registered_at);
CREATE INDEX IF NOT EXISTS idx_gps_devices_device_id ON gps_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_device_id_trgm ON gps_devices USING gin (device_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gps_devices_company_trgm ON gps_devices USING gin (transport_company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gps_devices_driver_name_trgm ON gps_devices USING gin (driver_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gps_devices_driver_phone_trgm ON gps_devices USING gin (driver_phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gps_devices_container_trgm ON gps_devices USING gin (container_no gin_trgm_ops);

-- Tracking
CREATE INDEX IF NOT EXISTS idx_tracking_last_seen ON tracking(last_seen);
CREATE INDEX IF NOT EXISTS idx_tracking_vessel_trgm ON tracking USING gin (vessel_name gin_trgm_ops);

