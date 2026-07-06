-- database/migrations/archive_employee_tables_down.sql

-- Revert archived employee table renames
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'archived_%' LOOP
    -- Only restore names that appear to be employee-related
    IF tbl.tablename LIKE 'archived_employee%' OR tbl.tablename LIKE 'archived_department%' OR tbl.tablename LIKE 'archived_salary%' OR tbl.tablename LIKE 'archived_attendance%' OR tbl.tablename LIKE 'archived_position%' OR tbl.tablename LIKE 'archived_payroll%' OR tbl.tablename LIKE 'archived_leave%' THEN
      EXECUTE format('ALTER TABLE IF EXISTS %I RENAME TO %s', tbl.tablename, substr(tbl.tablename,9));
    END IF;
  END LOOP;
END$$;
