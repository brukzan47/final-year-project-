-- database/migrations/archive_employee_tables_up.sql

-- Archive employee-related tables by renaming them to archived_* if they exist.
DO $$
DECLARE
  tbl RECORD;
  names TEXT[] := ARRAY['employee','employees','department','departments','salary','salaries','attendance','attendances','position','positions','payroll','payrolls','leave','leaves','hr'];
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    IF tbl.tablename = ANY(names) OR (tbl.tablename LIKE 'employee%' OR tbl.tablename LIKE 'department%' OR tbl.tablename LIKE 'salary%' OR tbl.tablename LIKE 'attendance%' OR tbl.tablename LIKE 'position%' OR tbl.tablename LIKE 'payroll%' OR tbl.tablename LIKE 'leave%') THEN
      EXECUTE format('ALTER TABLE IF EXISTS %I RENAME TO archived_%s', tbl.tablename, tbl.tablename);
    END IF;
  END LOOP;
END$$;
