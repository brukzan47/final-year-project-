-- database/seed.sql

-- Insert roles
INSERT INTO roles (role_name)
VALUES ('Admin'), ('Customs Officer'), ('Finance Officer'), ('Importer')
ON CONFLICT (role_name) DO NOTHING;

-- Default Admin
INSERT INTO users (full_name, email, password_hash, role_id)
VALUES (
  'System Administrator',
  'admin@customs.et',
  '$2a$10$3A7mxx3U1d1XbHk4L3fl8.OIbn5gCJy9HiH9B/7h7yzfH4Z3eIXvS', -- password: admin123
  (SELECT role_id FROM roles WHERE role_name = 'Admin')
)
ON CONFLICT (email) DO NOTHING;

-- Customs Officer
INSERT INTO users (full_name, email, password_hash, role_id)
VALUES (
  'Officer Dawit',
  'officer@customs.et',
  '$2a$10$zXMiwSDfG3E8ko3DNf7kSOxk1SKhA/1M5bRFXjKET3SszYQj/kPby', -- password: officer123
  (SELECT role_id FROM roles WHERE role_name = 'Customs Officer')
)
ON CONFLICT (email) DO NOTHING;
