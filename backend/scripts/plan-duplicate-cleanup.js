import "dotenv/config";
import { pool } from "../src/config/db.js";

async function shipmentPlan() {
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
    const score =
      row.declarations * 100 +
      row.documents * 20 +
      row.goods_items * 20 +
      row.tracking_snapshot * 10 +
      row.tracking_points * 2 +
      row.tracking_audits +
      row.gps_devices * 10 +
      row.transport_links * 5 +
      row.transport_events;
    const item = { ...row, dependency_score: score };
    const list = groups.get(row.shipment_reference) || [];
    list.push(item);
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

async function clearancePlan() {
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
    const completeness = [
      row.release_date,
      row.officer_name,
      row.customs_office,
      row.delivery_note_no,
      row.transport_company,
      row.truck_plate_no,
      row.destination_address,
    ].filter((value) => value !== null && value !== undefined && String(value).trim() !== "").length;
    const item = { ...row, completeness_score: completeness };
    const key = row.declaration_id;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
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

async function main() {
  const report = {
    mode: "dry-run",
    message: "No records were changed. Review survivor recommendations before cleanup.",
    duplicate_shipments: await shipmentPlan(),
    duplicate_clearances: await clearancePlan(),
  };
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Duplicate cleanup plan failed:", error.message);
    process.exit(1);
  });
