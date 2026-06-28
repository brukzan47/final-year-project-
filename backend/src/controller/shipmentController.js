import { Shipment } from "../models/Shipment.js";
import { pool } from "../config/db.js";
import { TrackingAudit } from "../models/TrackingAudit.js";
import { isImporterLike } from "../utils/roles.js";

function isIso6346Container(code) {
  if (!code) return false;
  let v = String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{4}\d{7}$/.test(v)) return false;
  const map = {
    A:10,B:12,C:13,D:14,E:15,F:16,G:17,H:18,I:19,J:20,
    K:21,L:23,M:24,N:25,O:26,P:27,Q:28,R:29,S:30,T:31,
    U:32,V:34,W:35,X:36,Y:37,Z:38,
  };
  const weights = [1,2,4,8,16,32,64,128,256,512];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = v[i];
    let val;
    if (/[A-Z]/.test(ch)) val = map[ch]; else val = Number(ch);
    sum += val * weights[i];
  }
  const check = (sum % 11) % 10;
  return check === Number(v[10]);
}

function generateTrackingRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 6);
  return `TRK-${y}${m}${day}-${rand}`;
}

function generateShipmentRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 6);
  return `SHP-${y}${m}${day}-${rand}`;
}

function isValidShipmentRef(ref) {
  if (!ref) return false;
  const v = String(ref).toUpperCase().trim();
  // Enforce canonical format: SHP-YYYYMMDD-XXXX (4-6 uppercase letters/digits)
  const pattern = /^SHP-\d{8}-[A-Z0-9]{4,6}$/;
  return pattern.test(v);
}

export const getShipments = async (req, res) => {
  try {
    let data;
    if (isImporterLike(req.user?.role) && req.user?.email) {
      const q = `
        SELECT s.*, i.company_name
        FROM shipments s
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE i.contact_email = $1
        ORDER BY s.created_at DESC;
      `;
      const r = await pool.query(q, [req.user.email]);
      data = r.rows;
    } else {
      data = await Shipment.getAll();
    }
    res.json(data);
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: err.message || "Shipment reference already in use" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const createShipment = async (req, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.tracking_ref === 'string') body.tracking_ref = body.tracking_ref.trim().toUpperCase();
    if (typeof body.shipment_reference === 'string') body.shipment_reference = body.shipment_reference.trim().toUpperCase();
    // Auto-generate tracking_ref if not provided
    if (!body.tracking_ref) {
      for (let i = 0; i < 5; i++) {
        const candidate = generateTrackingRef();
        const dupe = await pool.query("SELECT shipment_id FROM shipments WHERE tracking_ref=$1 LIMIT 1", [candidate]);
        if (dupe.rowCount === 0) { body.tracking_ref = candidate; break; }
      }
    }
    // Auto-generate shipment_reference if not provided
    if (!body.shipment_reference) {
      for (let i = 0; i < 5; i++) {
        const candidate = generateShipmentRef();
        const dupe = await pool.query("SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1", [candidate]);
        if (dupe.rowCount === 0) { body.shipment_reference = candidate; break; }
      }
    }
    if (body.tracking_ref) {
      const v = String(body.tracking_ref).toUpperCase();
      const awb = /^\d{3}-?\d{8}$/;
      const bl = /^[A-Z]{3,4}\d{7,}$/; // SCAC + digits
      const general = /^[A-Z0-9][A-Z0-9\/\-]{5,30}$/;
      if (!(awb.test(v) || bl.test(v) || general.test(v) || isIso6346Container(v))) {
        return res.status(400).json({ message: 'Invalid tracking_ref format' });
      }
      // Uniqueness check
      const dupe = await pool.query("SELECT shipment_id FROM shipments WHERE tracking_ref=$1 LIMIT 1", [v]);
      if (dupe.rowCount > 0) return res.status(409).json({ message: 'Tracking reference already in use' });
    }
    // If shipment_reference provided, ensure uniqueness
    if (body.shipment_reference) {
      const sr = String(body.shipment_reference).toUpperCase();
      if (!isValidShipmentRef(sr)) {
        return res.status(400).json({ message: 'Invalid shipment_reference format. Expected SHP-YYYYMMDD-XXXX' });
      }
      const dupeSR = await pool.query("SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1", [sr]);
      if (dupeSR.rowCount > 0) return res.status(409).json({ message: 'Shipment reference already in use' });
    }
    const shipment = await Shipment.create(body);
    // Audit creation with initial tracking_ref
    try {
      if (shipment?.shipment_id && body.tracking_ref) {
        await TrackingAudit.insert({ shipment_id: shipment.shipment_id, old_tracking_ref: null, new_tracking_ref: body.tracking_ref, changed_by: req.user?.email || req.user?.id || null });
      }
    } catch {}
    try {
      // Optionally create goods items if provided in payload
      const goodsItems = Array.isArray(body.goods_items) ? body.goods_items : [];
      if (shipment?.shipment_id && goodsItems.length > 0) {
        for (const gi of goodsItems) {
          if (!gi || !gi.hs_code) continue;
          await pool.query(
            `INSERT INTO goods_items (shipment_id, hs_code, description, quantity, unit_of_measure, value_usd, origin_country)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              shipment.shipment_id,
              gi.hs_code,
              gi.description || null,
              gi.quantity || null,
              gi.unit_of_measure || null,
              gi.value_usd || null,
              gi.origin_country || null,
            ]
          );
        }
      }
    } catch {}

    res.status(201).json(shipment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...(req.body || {}) };
    if (typeof body.tracking_ref === 'string') body.tracking_ref = body.tracking_ref.trim().toUpperCase();
    if (typeof body.shipment_reference === 'string') body.shipment_reference = body.shipment_reference.trim().toUpperCase();
    if (body.tracking_ref !== undefined && body.tracking_ref !== null && body.tracking_ref !== '') {
      const v = String(body.tracking_ref).toUpperCase();
      const awb = /^\d{3}-?\d{8}$/;
      const bl = /^[A-Z]{3,4}\d{7,}$/;
      const general = /^[A-Z0-9][A-Z0-9\/\-]{5,30}$/;
      if (!(awb.test(v) || bl.test(v) || general.test(v) || isIso6346Container(v))) {
        return res.status(400).json({ message: 'Invalid tracking_ref format' });
      }
    }
    if (body.shipment_reference !== undefined && body.shipment_reference !== null && body.shipment_reference !== '') {
      const sr = String(body.shipment_reference).toUpperCase();
      if (!isValidShipmentRef(sr)) {
        return res.status(400).json({ message: 'Invalid shipment_reference format. Expected SHP-YYYYMMDD-XXXX' });
      }
    }
    // If updating tracking_ref, ensure uniqueness
    if (body.tracking_ref) {
      const dupe = await pool.query("SELECT shipment_id FROM shipments WHERE tracking_ref=$1 AND shipment_id<>$2 LIMIT 1", [body.tracking_ref, id]);
      if (dupe.rowCount > 0) return res.status(409).json({ message: 'Tracking reference already in use' });
    }
    // If updating shipment_reference, ensure uniqueness
    if (body.shipment_reference) {
      const dupeSR = await pool.query("SELECT shipment_id FROM shipments WHERE shipment_reference=$1 AND shipment_id<>$2 LIMIT 1", [body.shipment_reference, id]);
      if (dupeSR.rowCount > 0) return res.status(409).json({ message: 'Shipment reference already in use' });
    }
    // fetch old for audit
    let oldRow = null;
    try { const r = await pool.query("SELECT tracking_ref FROM shipments WHERE shipment_id=$1", [id]); oldRow = r.rows[0] || null; } catch {}
    const updated = await Shipment.updateFields(id, body);
    if (!updated) return res.status(400).json({ message: 'No valid fields to update' });
    // Audit if changed
    try {
      if (oldRow && String(oldRow.tracking_ref || '') !== String(updated.tracking_ref || '')) {
        await TrackingAudit.insert({ shipment_id: id, old_tracking_ref: oldRow.tracking_ref || null, new_tracking_ref: updated.tracking_ref || null, changed_by: req.user?.email || req.user?.id || null });
      }
    } catch {}
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const findShipmentByRef = async (req, res) => {
  try {
    const ref = (req.query.ref || '').toString().trim();
    if (!ref) return res.status(400).json({ message: 'ref is required' });
    const row = await Shipment.getByReference(ref.toUpperCase());
    if (!row) return res.status(404).json({ message: 'Shipment not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const regenerateShipmentReference = async (req, res) => {
  try {
    const { id } = req.params;
    // Ensure shipment exists
    const existing = await pool.query(`SELECT shipment_id, shipment_reference FROM shipments WHERE shipment_id=$1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ message: 'Shipment not found' });

    // Generate unique reference
    let ref = null;
    for (let i = 0; i < 10; i++) {
      const candidate = generateShipmentRef();
      const dupe = await pool.query(`SELECT shipment_id FROM shipments WHERE shipment_reference=$1 AND shipment_id<>$2 LIMIT 1`, [candidate, id]);
      if (dupe.rowCount === 0) { ref = candidate; break; }
    }
    if (!ref) return res.status(500).json({ message: 'Failed to generate unique shipment reference' });

    const updated = await pool.query(`UPDATE shipments SET shipment_reference=$2 WHERE shipment_id=$1 RETURNING *`, [id, ref]);

    try {
      await TrackingAudit.insertShipmentRefChange({
        shipment_id: id,
        old_shipment_ref: existing.rows[0]?.shipment_reference || null,
        new_shipment_ref: ref,
        changed_by: req.user?.email || req.user?.id || null,
      });
    } catch {}

    return res.json(updated.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const backfillShipmentReferences = async (_req, res) => {
  try {
    // Find shipments with missing or invalid refs
    const rows = (await pool.query(
      `SELECT shipment_id, shipment_reference FROM shipments
       WHERE shipment_reference IS NULL OR shipment_reference = '' OR shipment_reference !~ '^SHP-[0-9]{8}-[A-Z0-9]{4,6}$'`
    )).rows || [];

    let updated = 0;
    for (const r of rows) {
      // Generate unique ref
      let ref = null;
      for (let i = 0; i < 10; i++) {
        const candidate = generateShipmentRef();
        const dupe = await pool.query(`SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1`, [candidate]);
        if (dupe.rowCount === 0) { ref = candidate; break; }
      }
      if (!ref) continue;
      await pool.query(`UPDATE shipments SET shipment_reference=$2 WHERE shipment_id=$1`, [r.shipment_id, ref]);
      try {
        await TrackingAudit.insertShipmentRefChange({
          shipment_id: r.shipment_id,
          old_shipment_ref: r.shipment_reference || null,
          new_shipment_ref: ref,
          changed_by: _req.user?.email || _req.user?.id || null,
        });
      } catch {}
      updated++;
    }
    return res.json({ scanned: rows.length, updated });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const reportInvalidReferences = async (_req, res) => {
  try {
    const invalid = (await pool.query(
      `SELECT shipment_id, shipment_reference
       FROM shipments
       WHERE shipment_reference IS NULL OR shipment_reference = '' OR shipment_reference !~ '^SHP-[0-9]{8}-[A-Z0-9]{4,6}$'`
    )).rows || [];

    const duplicates = (await pool.query(
      `WITH dup AS (
         SELECT shipment_reference
         FROM shipments
         WHERE shipment_reference IS NOT NULL AND shipment_reference <> ''
         GROUP BY shipment_reference HAVING COUNT(*) > 1
       )
       SELECT s.shipment_id, s.shipment_reference
       FROM shipments s
       JOIN dup d ON d.shipment_reference = s.shipment_reference
       ORDER BY s.shipment_reference`
    )).rows || [];

    return res.json({ invalid, duplicates });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
