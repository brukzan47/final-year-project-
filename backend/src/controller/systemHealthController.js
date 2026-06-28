import { pool } from "../config/db.js";

const INDEX_NAMES = [
  "idx_importers_customs_reg_no",
  "idx_shipments_tracking_ref_unique",
  "idx_shipments_shipment_ref_unique",
  "idx_clearances_declaration_unique",
];

const INDEX_BLOCKERS = {
  idx_importers_customs_reg_no: "importer_customs_registration_no",
  idx_shipments_tracking_ref_unique: "tracking_reference",
  idx_shipments_shipment_ref_unique: "shipment_reference",
  idx_clearances_declaration_unique: "clearance_declaration",
};

const INDEX_ACTIVATION_SQL = {
  idx_importers_customs_reg_no: "CREATE UNIQUE INDEX IF NOT EXISTS idx_importers_customs_reg_no ON importers(customs_registration_no) WHERE customs_registration_no IS NOT NULL AND BTRIM(customs_registration_no) <> '';",
  idx_shipments_tracking_ref_unique: "CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tracking_ref_unique ON shipments(tracking_ref) WHERE tracking_ref IS NOT NULL;",
  idx_shipments_shipment_ref_unique: "CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_shipment_ref_unique ON shipments(shipment_reference) WHERE shipment_reference IS NOT NULL;",
  idx_clearances_declaration_unique: "CREATE UNIQUE INDEX IF NOT EXISTS idx_clearances_declaration_unique ON clearances(declaration_id);",
};

function healthStatus(summary) {
  if (summary.duplicate_groups > 0 || summary.blocked_indexes > 0 || summary.deprecated_roles > 0) return "critical";
  if (summary.missing_unique_indexes > 0 || summary.ready_indexes > 0) return "warning";
  return "healthy";
}

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

async function duplicateStats({ table, key, where = `${key} IS NOT NULL` }) {
  if (!(await tableExists(table))) return { duplicate_groups: 0, duplicate_records: 0 };
  const result = await pool.query(
    `SELECT COUNT(*)::int AS duplicate_groups,
            COALESCE(SUM(duplicate_count), 0)::int AS duplicate_records
       FROM (
         SELECT COUNT(*)::int AS duplicate_count
           FROM ${table}
          WHERE ${where}
          GROUP BY ${key}
         HAVING COUNT(*) > 1
       ) duplicate_values`
  );
  return result.rows[0] || { duplicate_groups: 0, duplicate_records: 0 };
}

async function indexStatus() {
  const result = await pool.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname='public' AND indexname = ANY($1::text[])
      ORDER BY indexname`,
    [INDEX_NAMES]
  );
  const found = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));
  return INDEX_NAMES.map((name) => ({
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

async function shipmentCleanupPlan() {
  if (!(await tableExists("shipments"))) return [];
  const result = await pool.query(`
    WITH duplicates AS (
      SELECT shipment_reference
      FROM shipments
      WHERE shipment_reference IS NOT NULL
      GROUP BY shipment_reference
      HAVING COUNT(*) > 1
    )
    SELECT s.shipment_reference, s.shipment_id, s.created_at, s.tracking_ref,
           s.importer_id, s.description_of_goods,
           (SELECT COUNT(*)::int FROM declarations d WHERE d.shipment_id=s.shipment_id) AS declarations,
           (SELECT COUNT(*)::int FROM documents d WHERE d.shipment_id=s.shipment_id) AS documents,
           (SELECT COUNT(*)::int FROM goods_items g WHERE g.shipment_id=s.shipment_id) AS goods_items,
           (SELECT COUNT(*)::int FROM tracking_points t WHERE t.shipment_id=s.shipment_id) AS tracking_points,
           (SELECT COUNT(*)::int FROM tracking_audits t WHERE t.shipment_id=s.shipment_id) AS tracking_audits,
           (SELECT COUNT(*)::int FROM gps_devices g WHERE g.shipment_id=s.shipment_id) AS gps_devices,
           (SELECT COUNT(*)::int FROM transport_links t WHERE t.shipment_id=s.shipment_id) AS transport_links,
           (SELECT COUNT(*)::int
              FROM transport_events e
              JOIN transport_links l ON l.link_id=e.link_id
             WHERE l.shipment_id=s.shipment_id) AS transport_events,
           CASE WHEN EXISTS (SELECT 1 FROM tracking t WHERE t.shipment_id=s.shipment_id) THEN 1 ELSE 0 END AS tracking_snapshot
    FROM shipments s
    JOIN duplicates x ON x.shipment_reference=s.shipment_reference
    ORDER BY s.shipment_reference, s.created_at ASC, s.shipment_id
  `);

  const groups = new Map();
  for (const row of result.rows) {
    const dependencyScore =
      row.declarations * 100 +
      row.documents * 20 +
      row.goods_items * 20 +
      row.tracking_snapshot * 10 +
      row.tracking_points * 2 +
      row.tracking_audits +
      row.gps_devices * 10 +
      row.transport_links * 5 +
      row.transport_events;
    const list = groups.get(row.shipment_reference) || [];
    list.push({ ...row, dependency_score: dependencyScore });
    groups.set(row.shipment_reference, list);
  }

  return Array.from(groups, ([duplicate_value, records]) => {
    const ranked = records.slice().sort((a, b) =>
      b.dependency_score - a.dependency_score ||
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );
    return {
      duplicate_value,
      recommended_survivor: ranked[0]?.shipment_id || null,
      review_and_merge: ranked.slice(1).map((row) => row.shipment_id),
      records,
    };
  });
}

async function clearanceCleanupPlan() {
  if (!(await tableExists("clearances"))) return [];
  const result = await pool.query(`
    WITH duplicates AS (
      SELECT declaration_id
      FROM clearances
      GROUP BY declaration_id
      HAVING COUNT(*) > 1
    )
    SELECT c.*, d.declaration_no
    FROM clearances c
    JOIN duplicates x ON x.declaration_id=c.declaration_id
    LEFT JOIN declarations d ON d.declaration_id=c.declaration_id
    ORDER BY c.declaration_id, c.release_date DESC NULLS LAST, c.created_at DESC, c.clearance_id
  `);

  const groups = new Map();
  for (const row of result.rows) {
    const completenessScore = [
      row.release_date,
      row.officer_name,
      row.customs_office,
      row.delivery_note_no,
      row.transport_company,
      row.truck_plate_no,
      row.destination_address,
    ].filter((value) => value !== null && value !== undefined && String(value).trim() !== "").length;
    const list = groups.get(row.declaration_id) || [];
    list.push({ ...row, completeness_score: completenessScore });
    groups.set(row.declaration_id, list);
  }

  return Array.from(groups, ([declaration_id, records]) => {
    const ranked = records.slice().sort((a, b) =>
      b.completeness_score - a.completeness_score ||
      new Date(b.release_date || 0) - new Date(a.release_date || 0) ||
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    return {
      declaration_id,
      declaration_no: ranked[0]?.declaration_no || null,
      recommended_survivor: ranked[0]?.clearance_id || null,
      review_before_removal: ranked.slice(1).map((row) => row.clearance_id),
      records,
    };
  });
}

export const SystemHealthController = {
  async summary(_req, res) {
    try {
      const [importerStats, shipmentStats, trackingStats, clearanceStats, indexes, roles] = await Promise.all([
        duplicateStats({
          table: "importers",
          key: "customs_registration_no",
          where: "customs_registration_no IS NOT NULL AND BTRIM(customs_registration_no) <> ''",
        }),
        duplicateStats({
          table: "shipments",
          key: "shipment_reference",
          where: "shipment_reference IS NOT NULL",
        }),
        duplicateStats({
          table: "shipments",
          key: "tracking_ref",
          where: "tracking_ref IS NOT NULL",
        }),
        duplicateStats({
          table: "clearances",
          key: "declaration_id",
        }),
        indexStatus(),
        deprecatedRoles(),
      ]);
      const duplicateStatsByKey = {
        importer_customs_registration_no: importerStats,
        shipment_reference: shipmentStats,
        tracking_reference: trackingStats,
        clearance_declaration: clearanceStats,
      };
      const indexReadiness = indexes.map((index) => {
        const blockers = duplicateStatsByKey[INDEX_BLOCKERS[index.index]] || {};
        return {
          index: index.index,
          status: index.exists ? "protected" : blockers.duplicate_groups ? "blocked" : "ready",
        };
      });
      const stats = Object.values(duplicateStatsByKey);
      const summary = {
        duplicate_groups: stats.reduce((total, item) => total + item.duplicate_groups, 0),
        duplicate_records: stats.reduce((total, item) => total + item.duplicate_records, 0),
        missing_unique_indexes: indexes.filter((index) => !index.exists).length,
        deprecated_roles: roles.length,
        blocked_indexes: indexReadiness.filter((index) => index.status === "blocked").length,
        ready_indexes: indexReadiness.filter((index) => index.status === "ready").length,
      };

      return res.json({
        generated_at: new Date().toISOString(),
        status: healthStatus(summary),
        summary,
      });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async get(_req, res) {
    try {
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
      const indexes = await indexStatus();
      const roles = await deprecatedRoles();
      const cleanupPlan = {
        mode: "dry-run",
        message: "No records were changed. Review survivor recommendations before cleanup.",
        duplicate_shipments: await shipmentCleanupPlan(),
        duplicate_clearances: await clearanceCleanupPlan(),
      };
      const groups = Object.values(duplicates).flat();
      const indexReadiness = indexes.map((index) => {
        const duplicateKey = INDEX_BLOCKERS[index.index];
        const blockers = duplicates[duplicateKey] || [];
        const status = index.exists ? "protected" : blockers.length ? "blocked" : "ready";
        return {
          ...index,
          duplicate_key: duplicateKey,
          blocker_groups: blockers.length,
          blocker_records: blockers.reduce((total, group) => total + group.duplicate_count, 0),
          status,
          activation_sql: INDEX_ACTIVATION_SQL[index.index],
          required_action: status === "protected"
            ? "No action required"
            : status === "blocked"
              ? "Review and resolve duplicate groups before activating this unique index"
              : "Activate this unique index to prevent future duplicates",
        };
      });
      const summary = {
        duplicate_groups: groups.length,
        duplicate_records: groups.reduce((total, group) => total + group.duplicate_count, 0),
        missing_unique_indexes: indexes.filter((index) => !index.exists).length,
        deprecated_roles: roles.length,
        blocked_indexes: indexReadiness.filter((index) => index.status === "blocked").length,
        ready_indexes: indexReadiness.filter((index) => index.status === "ready").length,
      };

      return res.json({
        generated_at: new Date().toISOString(),
        status: healthStatus(summary),
        summary,
        duplicates,
        indexes,
        index_readiness: indexReadiness,
        deprecated_roles: roles,
        cleanup_plan: cleanupPlan,
        remediation_package: {
          mode: "proposal-only",
          message: "Review and run approved statements manually after duplicate blockers are resolved.",
          proposed_index_sql: indexReadiness
            .filter((index) => !index.exists)
            .map((index) => ({
              index: index.index,
              status: index.status,
              blocker_groups: index.blocker_groups,
              sql: index.activation_sql,
            })),
        },
      });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
};
