-- database/migrations/000_init_eims_down.sql

-- EIMS initial migration (DOWN) - Revert in reverse order of creation

DROP TABLE IF EXISTS ports;
DROP TABLE IF EXISTS hs_codes;
DROP TABLE IF EXISTS backups;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS clearance_certificates;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS inspections;
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS declarations;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS importers;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

-- Do NOT drop users table here unless this migration created it intentionally.

-- Drop ENUM types (if they exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
    DROP TYPE inspection_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    DROP TYPE payment_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'declaration_status') THEN
    DROP TYPE declaration_status;
  END IF;
END$$;
