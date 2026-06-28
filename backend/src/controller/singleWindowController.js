import { pool } from "../config/db.js";
import { getSingleWindowPollStatus } from "../integrations/singleWindowPoller.js";

export const getSingleWindowStatus = async (req, res) => {
  try {
    const { declarationId } = req.params;
    const q = await pool.query(
      `SELECT d.declaration_id, d.declaration_no, d.shipment_id,
              (SELECT jsonb_build_object('status', ca.status, 'request_ref', ca.request_ref)
               FROM currency_approvals ca WHERE ca.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS fx,
              (SELECT jsonb_build_object('status', ip.status, 'permit_no', ip.permit_no)
               FROM import_permits ip WHERE ip.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS permit,
              (SELECT jsonb_build_object('status', tl.status, 'provider_ref', tl.provider_ref)
               FROM transport_links tl WHERE tl.shipment_id=d.shipment_id ORDER BY updated_at DESC LIMIT 1) AS transport
       FROM declarations d
       WHERE d.declaration_id=$1
       LIMIT 1`,
      [declarationId]
    );
    if (q.rowCount === 0) return res.status(404).json({ message: 'Declaration not found' });
    res.json(q.rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const exportSingleWindowCsv = async (req, res) => {
  try {
    const { q: qs, fx, permit, transport, date_from, date_to } = req.query || {};
    const cond = [];
    const vals = [];
    if (qs && String(qs).trim()) {
      const v = `%${String(qs).trim()}%`;
      vals.push(v, v);
      cond.push(`(d.declaration_no ILIKE $${vals.length-1} OR i.company_name ILIKE $${vals.length})`);
    }
    if (fx && String(fx).toLowerCase() !== 'all') {
      vals.push(String(fx).toLowerCase());
      cond.push(`LOWER((SELECT status FROM currency_approvals ca WHERE ca.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1)) = $${vals.length}`);
    }
    if (permit && String(permit).toLowerCase() !== 'all') {
      vals.push(String(permit).toLowerCase());
      cond.push(`LOWER((SELECT status FROM import_permits ip WHERE ip.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1)) = $${vals.length}`);
    }
    if (transport && String(transport).toLowerCase() !== 'all') {
      vals.push(String(transport).toLowerCase());
      cond.push(`LOWER((SELECT status FROM transport_links tl WHERE tl.shipment_id=d.shipment_id ORDER BY updated_at DESC LIMIT 1)) = $${vals.length}`);
    }
    if (date_from) {
      vals.push(date_from);
      cond.push(`(d.declaration_date IS NULL OR d.declaration_date >= $${vals.length})`);
    }
    if (date_to) {
      vals.push(date_to);
      cond.push(`(d.declaration_date IS NULL OR d.declaration_date <= $${vals.length})`);
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const q = await pool.query(
      `SELECT 
        d.declaration_id,
        d.declaration_no,
        d.declaration_date,
        s.shipment_reference,
        i.company_name,
        (SELECT status FROM currency_approvals ca WHERE ca.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS fx_status,
        (SELECT request_ref FROM currency_approvals ca WHERE ca.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS fx_ref,
        (SELECT status FROM import_permits ip WHERE ip.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS permit_status,
        (SELECT permit_no FROM import_permits ip WHERE ip.declaration_id=d.declaration_id ORDER BY updated_at DESC LIMIT 1) AS permit_no,
        (SELECT status FROM transport_links tl WHERE tl.shipment_id=d.shipment_id ORDER BY updated_at DESC LIMIT 1) AS transport_status,
        (SELECT provider_ref FROM transport_links tl WHERE tl.shipment_id=d.shipment_id ORDER BY updated_at DESC LIMIT 1) AS transport_ref
      FROM declarations d
      JOIN shipments s ON s.shipment_id = d.shipment_id
      JOIN importers i ON s.importer_id = i.importer_id
      ${where}
      ORDER BY d.declaration_date DESC NULLS LAST, d.created_at DESC NULLS LAST;`,
      vals
    );
    const headers = [
      'declaration_no','declaration_date','importer','shipment_reference',
      'fx_status','fx_ref','permit_status','permit_no','transport_status','transport_ref'
    ];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [headers.join(',')];
    for (const r of q.rows) {
      const row = {
        declaration_no: r.declaration_no || '',
        declaration_date: r.declaration_date || '',
        importer: r.company_name || '',
        shipment_reference: r.shipment_reference || '',
        fx_status: r.fx_status || '',
        fx_ref: r.fx_ref || '',
        permit_status: r.permit_status || '',
        permit_no: r.permit_no || '',
        transport_status: r.transport_status || '',
        transport_ref: r.transport_ref || '',
      };
      lines.push(headers.map((h) => esc(row[h])).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="single-window.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getSingleWindowPollerStatus = async (_req, res) => {
  try {
    const status = getSingleWindowPollStatus();
    // Optional queued counts for visibility
    const counts = { fx_pending: 0, permit_pending: 0, transport_not_linked: 0 };
    try {
      const a = await pool.query(`SELECT COUNT(1) AS cnt FROM currency_approvals WHERE COALESCE(status,'Pending')='Pending'`);
      counts.fx_pending = Number(a.rows[0]?.cnt || 0);
    } catch {}
    try {
      const b = await pool.query(`SELECT COUNT(1) AS cnt FROM import_permits WHERE COALESCE(status,'Pending')='Pending'`);
      counts.permit_pending = Number(b.rows[0]?.cnt || 0);
    } catch {}
    try {
      const c = await pool.query(`SELECT COUNT(1) AS cnt FROM transport_links WHERE COALESCE(status,'') <> 'Linked'`);
      counts.transport_not_linked = Number(c.rows[0]?.cnt || 0);
    } catch {}
    res.json({ ...status, counts });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
