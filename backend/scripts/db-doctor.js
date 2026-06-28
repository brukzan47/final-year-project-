import { env } from "../src/config/env.js";
import { pool } from "../src/config/db.js";

async function tableExists(tableName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1
     ) AS exists`,
    [tableName]
  );
  return !!result.rows[0]?.exists;
}

async function duplicateGroups({ table, key, id, where = `${key} IS NOT NULL` }) {
  if (!(await tableExists(table))) return [];
  const result = await pool.query(
    `SELECT ${key} AS duplicate_value,
            COUNT(*)::int AS duplicate_count,
            ARRAY_AGG(${id}::text ORDER BY ${id}::text) AS record_ids
       FROM ${table}
      WHERE ${where}
      GROUP BY ${key}
     HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, ${key} ASC`
  );
  return result.rows;
}

async function indexStatus() {
  const names = [
    "idx_importers_customs_reg_no",
    "idx_shipments_tracking_ref_unique",
    "idx_shipments_shipment_ref_unique",
    "idx_clearances_declaration_unique",
  ];
  const result = await pool.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname='public' AND indexname = ANY($1::text[])
      ORDER BY indexname`,
    [names]
  );
  const found = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));
  return names.map((name) => ({
    index: name,
    exists: found.has(name),
    definition: found.get(name) || null,
  }));
}

async function deprecatedRoles() {
  if (!(await tableExists("roles"))) return [];
  const result = await pool.query(
    `SELECT r.role_id, r.role_name,
            (SELECT COUNT(*)::int FROM users u WHERE u.role_id=r.role_id) AS user_count,
            (SELECT COUNT(*)::int FROM user_role_audit a WHERE a.old_role_id=r.role_id OR a.new_role_id=r.role_id) AS audit_count
       FROM roles r
      WHERE r.role_name='Economic Operator'`
  );
  return result.rows;
}

async function main() {
  console.log("Checking DB connectivity...", {
    host: env.db.host,
    database: env.db.database,
    user: env.db.user,
    port: env.db.port,
  });
  const v = await pool.query("select version();");
  console.log("Server version:", v.rows[0].version);

  const tables = await pool.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1;"
  );
  console.log("Public tables:", tables.rows.map((r) => r.table_name));

  const duplicates = {
    importer_customs_registration_no: await duplicateGroups({
      table: "importers",
      key: "customs_registration_no",
      id: "importer_id",
      where: "customs_registration_no IS NOT NULL AND BTRIM(customs_registration_no) <> ''",
    }),
    shipment_reference: await duplicateGroups({
      table: "shipments",
      key: "shipment_reference",
      id: "shipment_id",
      where: "shipment_reference IS NOT NULL",
    }),
    tracking_reference: await duplicateGroups({
      table: "shipments",
      key: "tracking_ref",
      id: "shipment_id",
      where: "tracking_ref IS NOT NULL",
    }),
    clearance_declaration: await duplicateGroups({
      table: "clearances",
      key: "declaration_id",
      id: "clearance_id",
    }),
  };

  console.log("Duplicate data report:");
  console.log(JSON.stringify(duplicates, null, 2));
  console.log("Unique index status:");
  console.log(JSON.stringify(await indexStatus(), null, 2));
  console.log("Deprecated role report:");
  console.log(JSON.stringify(await deprecatedRoles(), null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("DB doctor failed:", e.message);
    process.exit(1);
  });
