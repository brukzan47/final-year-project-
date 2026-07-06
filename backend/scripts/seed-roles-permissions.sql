-- backend/scripts/seed-roles-permissions.sql

-- Seed default roles
INSERT INTO roles (name, description) VALUES
('Importer','Importer - can create and manage own declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES
('Customs Officer','Can review and approve declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES
('Inspector','Can be assigned inspections and complete reports') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES
('Finance Officer','Can manage payments and revenue') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES
('Administrator','Full system administration') ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO permissions (name, description) VALUES
('importers:create','Create importers') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('importers:read','Read importers') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('importers:update','Update importers') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('shipments:crud','Create/Read/Update/Delete shipments') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('declarations:create','Create declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('declarations:submit','Submit declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('declarations:review','Review declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('declarations:approve','Approve declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('declarations:reject','Reject declarations') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('documents:upload','Upload declaration/shipment documents') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('inspections:schedule','Schedule inspections') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('inspections:conduct','Conduct inspections') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('payments:create','Create payments records') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('payments:confirm','Confirm payment status') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('clearances:generate','Generate clearance certificates') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('system:settings','Manage system settings') ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles (example mapping)
-- Note: roles and permissions IDs are UUIDs; use subselects to map names to IDs
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Administrator' AND p.name IN (
  'importers:create','importers:read','importers:update','shipments:crud','declarations:create','declarations:submit','declarations:review','declarations:approve','declarations:reject','documents:upload','inspections:schedule','inspections:conduct','payments:create','payments:confirm','clearances:generate','system:settings'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Importer' AND p.name IN (
  'importers:create','importers:read','importers:update','declarations:create','declarations:submit','documents:upload'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Customs Officer' AND p.name IN (
  'declarations:review','declarations:approve','declarations:reject','documents:upload'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Inspector' AND p.name IN (
  'inspections:schedule','inspections:conduct','documents:upload'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='Finance Officer' AND p.name IN (
  'payments:create','payments:confirm'
) ON CONFLICT DO NOTHING;
