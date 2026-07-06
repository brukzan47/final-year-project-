# docs/migration-notes.md

Migration pre-check & backup checklist

1. Confirm environment and branch
   - Ensure you are running migrations against the correct database (staging/production).
   - Ensure you are on branch: eims-conversion

2. Take a full database dump before any migration
   - pg_dump --format=custom --file=backups/pre_migration_$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
   - Copy the dump file to ./storage/backups and record an entry in the backups table if available.

3. Archive employee-related tables (non-destructive)
   - Run: psql "$DATABASE_URL" -f database/migrations/archive_employee_tables_up.sql
   - This will rename employee-related tables to archived_* so code changes won't break and data is preserved.

4. Apply EIMS schema migrations
   - Run: node backend/scripts/apply-migration.js database/migrations/000_init_eims_up.sql

5. Seed roles & permissions
   - Run: psql "$DATABASE_URL" -f backend/scripts/seed-roles-permissions.sql

6. Run test suite
   - cd backend
   - npm ci
   - npm test

7. Verify data integrity & application behavior
   - Log in as administrator and confirm roles exist.
   - Confirm importer registration flow creates pending users and importers.

Rollback procedure (if needed)

1. Restore DB from dump (recommended):
   - pg_restore --clean --dbname="$DATABASE_URL" backups/pre_migration_YYYYMMDDHHMM.dump

2. Or run down migrations in reverse order:
   - node backend/scripts/apply-migration.js database/migrations/000_init_eims_down.sql
   - node backend/scripts/apply-migration.js database/migrations/archive_employee_tables_down.sql

Notes

- All migrations provided include UP and DOWN SQL where applicable. Ensure backups are taken before performing any DOWN operations on production.
- Employee data is archived (renamed) rather than dropped. Dropping archived tables should only be done after a legal and operational retention period and with explicit approval.
