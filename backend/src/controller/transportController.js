import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { linkShipment, getLinkStatus } from "../clients/transportClient.js";
import { hmacValid } from "../utils/webhookVerify.js";

export const createTransportLink = async (req, res) => {
  try {
    const { shipment_id, tracking_ref } = req.body || {};
    if (!shipment_id) return res.status(400).json({ message: "shipment_id required" });
    const r = await linkShipment({ shipment_id, tracking_ref });
    const ins = await pool.query(
      `INSERT INTO transport_links (shipment_id, provider, provider_ref, status, raw)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (provider_ref) DO UPDATE SET status=EXCLUDED.status, updated_at=now(), raw=EXCLUDED.raw
       RETURNING *`,
      [shipment_id, r.provider || 'Transport', r.provider_ref || null, r.status || 'Linked', JSON.stringify(r)]
    );
    res.json(ins.rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getTransportLink = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const q = await pool.query(`SELECT * FROM transport_links WHERE shipment_id=$1 ORDER BY updated_at DESC LIMIT 1`, [shipmentId]);
    const row = q.rows[0] || null;
    if (!row) return res.json(null);
    if (row.status !== 'Linked' && env.singleWindow?.transport?.enabled && row.provider_ref) {
      const s = await getLinkStatus({ provider_ref: row.provider_ref });
      await pool.query(`UPDATE transport_links SET status=$1, raw=$2, updated_at=now() WHERE link_id=$3`, [s.status || row.status, JSON.stringify(s), row.link_id]);
      const fresh = await pool.query(`SELECT * FROM transport_links WHERE link_id=$1`, [row.link_id]);
      return res.json(fresh.rows[0]);
    }
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const transportWebhook = async (req, res) => {
  try {
    const secret = env.singleWindow?.transport?.webhookSecret || "";
    if (secret && !hmacValid(req, secret)) return res.status(401).json({ message: "invalid signature" });
    const { provider_ref, event_type, ts, lat, lon } = req.body || {};
    if (!provider_ref) return res.status(400).json({ message: "provider_ref required" });
    const link = await pool.query(`SELECT link_id FROM transport_links WHERE provider_ref=$1 LIMIT 1`, [provider_ref]);
    const link_id = link.rows[0]?.link_id || null;
    if (link_id) {
      await pool.query(
        `INSERT INTO transport_events (link_id, ts, event_type, lat, lon, raw) VALUES ($1,$2,$3,$4,$5,$6)`,
        [link_id, ts || new Date(), event_type || null, lat || null, lon || null, JSON.stringify(req.body || {})]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getTransportEvents = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const link = await pool.query(`SELECT link_id FROM transport_links WHERE shipment_id=$1 ORDER BY updated_at DESC LIMIT 1`, [shipmentId]);
    const link_id = link.rows[0]?.link_id;
    if (!link_id) return res.json({ items: [], total: 0 });
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const r = await pool.query(
      `SELECT event_id, ts, event_type, lat, lon, raw
         FROM transport_events
        WHERE link_id=$1
        ORDER BY ts DESC
        OFFSET $2 LIMIT $3`,
      [link_id, offset, limit]
    );
    let total = r.rows.length + offset;
    try {
      const c = await pool.query(`SELECT COUNT(1) AS cnt FROM transport_events WHERE link_id=$1`, [link_id]);
      total = Number(c.rows[0]?.cnt || r.rows.length);
    } catch {}
    res.json({ items: r.rows, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const exportTransportEventsCsv = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const link = await pool.query(
      `SELECT link_id FROM transport_links WHERE shipment_id=$1 ORDER BY updated_at DESC LIMIT 1`,
      [shipmentId]
    );
    const link_id = link.rows[0]?.link_id;
    if (!link_id) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="events-${shipmentId}.csv"`);
      res.send('ts,event_type,lat,lon\n');
      return;
    }
    const r = await pool.query(
      `SELECT ts, event_type, lat, lon FROM transport_events WHERE link_id=$1 ORDER BY ts DESC`,
      [link_id]
    );
    const headers = ['ts','event_type','lat','lon'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [headers.join(',')];
    for (const row of r.rows) {
      lines.push(headers.map((h) => esc(row[h])).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="events-${shipmentId}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
