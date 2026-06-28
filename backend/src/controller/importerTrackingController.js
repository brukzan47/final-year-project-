import { pool } from "../config/db.js";
import { isImporterLike } from "../utils/roles.js";

async function findByDeclarationNo(q, qNorm) {
  const sql = `
    SELECT d.*, s.shipment_id, s.shipment_reference, s.tracking_ref
    FROM declarations d
    JOIN shipments s ON d.shipment_id = s.shipment_id
    WHERE UPPER(COALESCE(d.declaration_no, '')) = $1
       OR REGEXP_REPLACE(UPPER(COALESCE(d.declaration_no, '')), '[^A-Z0-9]', '', 'g') = $2
       OR UPPER(COALESCE(d.declaration_no, '')) LIKE $3
    LIMIT 1;
  `;
  const like = `%${q}%`;
  const r = await pool.query(sql, [q, qNorm, like]);
  return r.rows[0] || null;
}

async function findByShipmentRef(q, qNorm) {
  const sql = `
    SELECT s.*, d.declaration_id, d.declaration_no
    FROM shipments s
    LEFT JOIN declarations d ON d.shipment_id = s.shipment_id
    WHERE UPPER(COALESCE(s.shipment_reference, '')) = $1
       OR UPPER(COALESCE(s.tracking_ref, '')) = $1
       OR REGEXP_REPLACE(UPPER(COALESCE(s.shipment_reference, '')), '[^A-Z0-9]', '', 'g') = $2
       OR REGEXP_REPLACE(UPPER(COALESCE(s.tracking_ref, '')), '[^A-Z0-9]', '', 'g') = $2
       OR UPPER(COALESCE(s.shipment_reference, '')) LIKE $3
       OR UPPER(COALESCE(s.tracking_ref, '')) LIKE $3
       OR UPPER(s.shipment_id::text) = $1
       OR REPLACE(UPPER(s.shipment_id::text), '-', '') = $2
       OR UPPER(d.declaration_id::text) = $1
       OR REPLACE(UPPER(d.declaration_id::text), '-', '') = $2
    ORDER BY d.declaration_date DESC NULLS LAST, s.created_at DESC
    LIMIT 1;
  `;
  const like = `%${q}%`;
  const r = await pool.query(sql, [q, qNorm, like]);
  return r.rows[0] || null;
}

async function latestPayment(declaration_id) {
  const r = await pool.query(
    `SELECT payment_status, payment_date FROM payments
     WHERE declaration_id = $1
     ORDER BY payment_date DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;`,
    [declaration_id]
  );
  return r.rows[0] || null;
}

async function latestInspection(declaration_id) {
  const r = await pool.query(
    `SELECT inspection_result, inspection_date FROM inspections
     WHERE declaration_id = $1
     ORDER BY inspection_date DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;`,
    [declaration_id]
  );
  return r.rows[0] || null;
}

async function clearanceFor(declaration_id) {
  const r = await pool.query(
    `SELECT clearance_id, release_date FROM clearances
     WHERE declaration_id = $1
     ORDER BY release_date DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;`,
    [declaration_id]
  );
  return r.rows[0] || null;
}

async function requiredDocsStatus(declaration_id) {
  const q = await pool.query(
    `SELECT title FROM documents WHERE declaration_id = $1`,
    [declaration_id]
  );
  const titles = (q.rows || []).map((r) => String(r.title || "").trim().toLowerCase());
  const requirements = [
    { label: "Commercial Invoice", anyOf: ["commercial invoice"] },
    { label: "Packing List", anyOf: ["packing list"] },
    { label: "Bill of Lading / Airway Bill", anyOf: ["bill of lading", "airway bill"] },
    { label: "Certificate of Origin", anyOf: ["certificate of origin"] },
    { label: "Import Permit / Letter of Credit", anyOf: ["import permit", "letter of credit"] },
    { label: "Insurance Certificate", anyOf: ["insurance certificate"] },
  ];
  const missing = [];
  for (const reqItem of requirements) {
    const ok = reqItem.anyOf.some((a) => titles.some((t) => t.includes(a)));
    if (!ok) missing.push(reqItem.label);
  }
  return { ok: missing.length === 0, missing };
}

async function canAccessDeclaration(req, declaration_id) {
  if (!isImporterLike(req.user?.role)) return true;
  const own = await pool.query(
    `SELECT 1
       FROM declarations d
       JOIN shipments s ON d.shipment_id = s.shipment_id
       JOIN importers i ON s.importer_id = i.importer_id
      WHERE d.declaration_id = $1 AND i.contact_email = $2
      LIMIT 1`,
    [declaration_id, req.user?.email || null]
  );
  return own.rowCount > 0;
}

function buildTimeline({ declaration, pay, insp, clr }) {
  const timeline = [];
  timeline.push({
    key: 'declaration_submitted',
    icon: '??',
    title: 'Declaration Submitted',
    status: declaration ? 'Completed' : 'Pending',
    description: declaration ? 'Import declaration received' : 'Awaiting submission',
    date: declaration?.declaration_date || null,
  });
  const declStatus = (declaration?.status || '').toLowerCase();
  const valuationDoneByStatus = ['accepted', 'paid', 'cleared', 'released', 'rejected'].includes(declStatus);
  const valuationDoneByData =
    declaration &&
    (
      declaration.tariff_rate !== null && declaration.tariff_rate !== undefined ||
      declaration.duties_etb !== null && declaration.duties_etb !== undefined
    );
  const valuationDone = !!(valuationDoneByStatus || valuationDoneByData);
  timeline.push({
    key: 'valuation',
    icon: '??',
    title: 'Valuation',
    status: valuationDone ? 'Completed' : 'In Progress',
    description: valuationDone ? 'Valuation completed' : 'Customs officer verifying invoice',
  });
  const payStatus = (pay?.payment_status || '').toLowerCase();
  const payOk = payStatus === 'verified' || payStatus === 'paid';
  timeline.push({
    key: 'payment',
    icon: '??',
    title: 'Payment',
    status: payOk ? 'Confirmed' : 'Pending',
    description: payOk ? 'Duties and taxes paid' : 'Awaiting payment confirmation',
    date: pay?.payment_date || null,
  });
  const inspStatus = (insp?.inspection_result || '').toLowerCase();
  const inspDone = inspStatus && inspStatus !== 'pending' && inspStatus !== 'required';
  timeline.push({
    key: 'inspection',
    icon: '??',
    title: 'Inspection',
    status: inspDone ? 'Completed' : 'Pending',
    description: inspDone ? 'Inspection completed' : 'Awaiting inspection date',
    date: insp?.inspection_date || null,
  });
  const cleared = !!clr?.clearance_id;
  timeline.push({
    key: 'release',
    icon: '??',
    title: 'Release',
    status: cleared ? 'Cleared' : 'Pending',
    description: cleared ? 'Goods released from customs' : 'Awaiting release',
    date: clr?.release_date || null,
  });
  timeline.push({
    key: 'delivery',
    icon: '??',
    title: 'Delivery',
    status: cleared ? 'In Transit' : 'Pending',
    description: cleared ? 'Goods ready for pickup/delivery' : 'Pending clearance',
  });
  return timeline;
}

export const importerTrackingSearch = async (req, res) => {
  try {
    const raw = (req.query.q || '').toString().trim();
    if (!raw) return res.status(400).json({ message: 'q is required' });
    const q = raw.toUpperCase();
    const qNorm = q.replace(/[^A-Z0-9]/g, '');
    let head = await findByDeclarationNo(q, qNorm);
    if (!head) head = await findByShipmentRef(q, qNorm);
    if (!head) return res.status(404).json({ message: 'No records found' });
    let decl = null;
    let pay = null;
    let insp = null;
    let clr = null;
    const declaration_id = head.declaration_id || head.declarationid || head.declaration_id;
    if (declaration_id) {
      const dr = await pool.query(`SELECT * FROM declarations WHERE declaration_id=$1 LIMIT 1`, [declaration_id]);
      decl = dr.rows[0] || null;
      pay = await latestPayment(declaration_id);
      insp = await latestInspection(declaration_id);
      clr = await clearanceFor(declaration_id);
    }
    const docs = declaration_id ? await requiredDocsStatus(declaration_id) : { ok: false, missing: [] };
    const payStatus = String(pay?.payment_status || "").toLowerCase();
    const inspStatus = String(insp?.inspection_result || "").toLowerCase();
    const inspectionOk = !inspStatus || ["passed", "green", "not required", "completed"].includes(inspStatus);
    const releaseReady = !!declaration_id && !!clr?.clearance_id && (payStatus === "paid" || payStatus === "verified") && docs.ok && inspectionOk;
    const resp = {
      query: raw,
      shipment: {
        shipment_id: head.shipment_id,
        shipment_reference: head.shipment_reference,
        tracking_ref: head.tracking_ref,
      },
      declaration: decl ? {
        declaration_id: decl.declaration_id,
        declaration_no: decl.declaration_no,
        status: decl.status,
        declaration_date: decl.declaration_date,
      } : null,
      release_ready: releaseReady,
      release_requirements: {
        payment_ok: payStatus === "paid" || payStatus === "verified",
        inspection_ok: inspectionOk,
        clearance_ok: !!clr?.clearance_id,
        docs_ok: !!docs.ok,
        missing_docs: docs.missing || [],
      },
      timeline: buildTimeline({ declaration: decl, pay, insp, clr }),
    };
    res.json(resp);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const downloadReleaseDocs = async (req, res) => {
  try {
    const { declarationId } = req.params;
    if (!declarationId) return res.status(400).json({ message: "declarationId is required" });

    const allowed = await canAccessDeclaration(req, declarationId);
    if (!allowed) return res.status(403).json({ message: "Not allowed for this declaration" });

    const [pay, insp, clr, docs] = await Promise.all([
      latestPayment(declarationId),
      latestInspection(declarationId),
      clearanceFor(declarationId),
      requiredDocsStatus(declarationId),
    ]);
    const payStatus = String(pay?.payment_status || "").toLowerCase();
    const inspStatus = String(insp?.inspection_result || "").toLowerCase();
    const inspectionOk = !inspStatus || ["passed", "green", "not required", "completed"].includes(inspStatus);
    const ready = !!clr?.clearance_id && (payStatus === "paid" || payStatus === "verified") && docs.ok && inspectionOk;
    if (!ready) {
      return res.status(409).json({
        message: "Release requirements not completed",
        requirements: {
          payment_ok: payStatus === "paid" || payStatus === "verified",
          inspection_ok: inspectionOk,
          clearance_ok: !!clr?.clearance_id,
          docs_ok: !!docs.ok,
          missing_docs: docs.missing || [],
        },
      });
    }

    const docRows = await pool.query(
      `SELECT document_id, title, file_name, uploaded_at
         FROM documents
        WHERE declaration_id = $1
        ORDER BY uploaded_at DESC`,
      [declarationId]
    );
    const decl = await pool.query(
      `SELECT declaration_no FROM declarations WHERE declaration_id = $1 LIMIT 1`,
      [declarationId]
    );
    const declarationNo = decl.rows[0]?.declaration_no || declarationId;
    const origin = `${req.protocol}://${req.get("host")}`;
    const headers = ["declaration_no", "title", "file_name", "file_url", "uploaded_at"];
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(",")];
    for (const d of docRows.rows || []) {
      const row = [
        declarationNo,
        d.title || "",
        d.file_name || "",
        `${origin}/api/documents/${encodeURIComponent(d.document_id)}/file`,
        d.uploaded_at || "",
      ];
      lines.push(row.map(esc).join(","));
    }
    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="release-docs-${declarationNo}.csv"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};


