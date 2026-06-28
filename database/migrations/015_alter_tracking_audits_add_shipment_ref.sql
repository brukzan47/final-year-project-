-- Add columns to audit shipment_reference changes as well
ALTER TABLE tracking_audits
  ADD COLUMN IF NOT EXISTS old_shipment_ref VARCHAR(50),
  ADD COLUMN IF NOT EXISTS new_shipment_ref VARCHAR(50);

