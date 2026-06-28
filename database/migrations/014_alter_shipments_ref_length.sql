-- Align shipment_reference length to 50 to match schema and UI
ALTER TABLE shipments
  ALTER COLUMN shipment_reference TYPE VARCHAR(50);

