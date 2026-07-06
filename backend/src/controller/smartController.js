import { env } from "../config/env.js";
import { SmartIndex } from "../models/SmartIndex.js";
import { OcrExtract } from "../models/OcrExtract.js";
import { embedText } from "../services/smart/embeddingService.js";
import { suggestHs, estimateValue } from "../services/smart/hsSuggestService.js";
import { extractFields } from "../services/smart/ocrService.js";
import { pool } from "../config/db.js";
import { Document } from "../models/Document.js";

function guardEnabled(res, key = 'enabled') {
  if (!env.smart?.[key] && key !== 'enabled') return res.status(503).json({ message: `Smart ${key} not enabled` });
  if (!env.smart?.enabled && key === 'enabled') return res.status(503).json({ message: 'Smart not enabled' });
  return null;
}

// Parse simple prefixes inside the query to support exact filters
// Supported: dec:, ref:, imp:, doc:, dev:, trk:, hs:
function parsePrefixes(raw = '') {
  const out = { q: String(raw || '').trim() };
  const re = /(\b(dec|ref|imp|doc|dev|trk|hs):)(\S+)/ig;
  const seen = [];
  let m;
  while ((m = re.exec(out.q))) {
    const key = (m[2] || '').toLowerCase();
    const val = (m[3] || '').replace(/[+]/g, ' ');
    if (key === 'dec') out.decNo = val;
    if (key === 'ref') out.shipRef = val;
    if (key === 'imp') out.impName = val;
    if (key === 'doc') out.docName = val;
    if (key === 'dev') out.deviceId = val;
    if (key === 'trk') out.trackRef = val;
    if (key === 'hs') out.hsCode = val;
    seen.push(m[0]);
  }
  if (seen.length) {
    out.q = out.q.replace(re, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  return out;
}

async function fallbackCounts({ q, types = [], filters = {} }) {
  const like = `%${String(q || '').trim()}%`;
  const all = ["declaration", "shipment", "importer", "document", "device", "tracking"];
  const useTypes = (types && types.length) ? types : all;
  const { origin, destination, decl_status, station, from, to, decNo, shipRef, impName, docName, deviceId, trackRef, hsCode } = filters || {};
  const out = {};
  if (useTypes.includes("shipment")) {
    const params = [like];
    let where = `(
      s.shipment_reference ILIKE $1 OR s.tracking_ref ILIKE $1 OR s.description_of_goods ILIKE $1 OR s.hs_code ILIKE $1 OR s.origin_country ILIKE $1 OR s.destination_port ILIKE $1
    )`;
    if (origin) { params.push(`%${origin}%`); where += ` AND s.origin_country ILIKE $${params.length}`; }
    if (destination) { params.push(`%${destination}%`); where += ` AND s.destination_port ILIKE $${params.length}`; }
    if (from) { params.push(from); where += ` AND (s.created_at IS NULL OR s.created_at >= $${params.length})`; }
    if (to) { params.push(to); where += ` AND (s.created_at IS NULL OR s.created_at <= $${params.length})`; }
    if (shipRef) { params.push(shipRef); where += ` AND s.shipment_reference = $${params.length}`; }
    if (trackRef) { params.push(trackRef); where += ` AND s.tracking_ref = $${params.length}`; }
    if (hsCode) { params.push(`%${hsCode}%`); where += ` AND s.hs_code ILIKE $${params.length}`; }
    const sql = `SELECT COUNT(1) AS cnt FROM shipments s LEFT JOIN importers i ON i.importer_id=s.importer_id WHERE ${where}`;
    const r = await pool.query(sql, params); out.shipment = Number(r.rows[0]?.cnt||0);
  }
  if (useTypes.includes("declaration")) {
    const params = [like];
    let where = `(
      d.declaration_no ILIKE $1 OR d.status ILIKE $1 OR d.customs_station ILIKE $1 OR s.shipment_reference ILIKE $1 OR i.company_name ILIKE $1
    )`;
    if (decl_status) { params.push(`%${decl_status}%`); where += ` AND d.status ILIKE $${params.length}`; }
    if (station) { params.push(`%${station}%`); where += ` AND d.customs_station ILIKE $${params.length}`; }
    if (from) { params.push(from); where += ` AND (d.created_at IS NULL OR d.created_at >= $${params.length})`; }
    if (to) { params.push(to); where += ` AND (d.created_at IS NULL OR d.created_at <= $${params.length})`; }
    if (decNo) { params.push(decNo); where += ` AND d.declaration_no = $${params.length}`; }
    const sql = `SELECT COUNT(1) AS cnt FROM declarations d LEFT JOIN shipments s ON s.shipment_id=d.shipment_id LEFT JOIN importers i ON i.importer_id=s.importer_id WHERE ${where}`;
    const r = await pool.query(sql, params); out.declaration = Number(r.rows[0]?.cnt||0);
  }
  if (useTypes.includes("importer")) {
    const params = [like];
    let where = `company_name ILIKE $1 OR tin_number ILIKE $1 OR contact_email ILIKE $1 OR contact_phone ILIKE $1`;
    if (impName) { params.push(impName); where += ` OR company_name = $${params.length}`; }
    const sql = `SELECT COUNT(1) AS cnt FROM importers WHERE ${where}`;
    const r = await pool.query(sql, params); out.importer = Number(r.rows[0]?.cnt||0);
  }
  if (useTypes.includes("document")) {
    const params = [like];
    let where = `title ILIKE $1 OR file_name ILIKE $1 OR file_type ILIKE $1`;
    if (docName) { params.push(docName); where += ` OR file_name = $${params.length}`; }
    const sql = `SELECT COUNT(1) AS cnt FROM documents WHERE ${where}`;
    const r = await pool.query(sql, params); out.document = Number(r.rows[0]?.cnt||0);
  }
  if (useTypes.includes("device")) {
    const params = [like];
    let where = `device_id ILIKE $1 OR transport_company ILIKE $1 OR driver_name ILIKE $1 OR driver_phone ILIKE $1 OR container_no ILIKE $1`;
    if (deviceId) { params.push(deviceId); where += ` OR device_id = $${params.length}`; }
    const sql = `SELECT COUNT(1) AS cnt FROM gps_devices WHERE ${where}`;
    const r = await pool.query(sql, params); out.device = Number(r.rows[0]?.cnt||0);
  }
  if (useTypes.includes("tracking")) {
    const r = await pool.query(`SELECT COUNT(1) AS cnt FROM tracking WHERE vessel_name ILIKE $1`, [like]); out.tracking = Number(r.rows[0]?.cnt||0);
  }
  out.total = Object.values(out).reduce((a,b)=> a + (typeof b === 'number' ? b : 0), 0);
  return out;
}

async function fallbackSearch({ q, types = [], limit = 50, offset = 0, filters = {} }) {
  const results = [];
  const like = `%${String(q || '').trim()}%`;
  const all = ["declaration", "shipment", "importer", "document", "device", "tracking"];
  const useTypes = (types && types.length) ? types : all;
  const perType = Math.max(10, Math.ceil(limit / Math.max(1,useTypes.length)) * 2);
  const { origin, destination, decl_status, station, from, to, decNo, shipRef, impName, docName, deviceId, trackRef, hsCode } = filters || {};

  if (useTypes.includes("shipment")) {
    const params = [];
    let where = `(
      s.shipment_reference ILIKE $1 OR s.tracking_ref ILIKE $1 OR s.description_of_goods ILIKE $1 OR s.hs_code ILIKE $1 OR s.origin_country ILIKE $1 OR s.destination_port ILIKE $1
    )`;
    params.push(like);
    if (origin) { params.push(`%${origin}%`); where += ` AND s.origin_country ILIKE $${params.length}`; }
    if (destination) { params.push(`%${destination}%`); where += ` AND s.destination_port ILIKE $${params.length}`; }
    if (from) { params.push(from); where += ` AND (s.created_at IS NULL OR s.created_at >= $${params.length})`; }
    if (to) { params.push(to); where += ` AND (s.created_at IS NULL OR s.created_at <= $${params.length})`; }
    if (shipRef) { params.push(shipRef); where += ` AND s.shipment_reference = $${params.length}`; }
    if (trackRef) { params.push(trackRef); where += ` AND s.tracking_ref = $${params.length}`; }
    if (hsCode) { params.push(`%${hsCode}%`); where += ` AND s.hs_code ILIKE $${params.length}`; }
    const sql = `SELECT 'shipment' AS entity_type, s.shipment_id AS entity_id,
      CONCAT(COALESCE(s.shipment_reference,''),' ',COALESCE(s.tracking_ref,''),' ',COALESCE(s.description_of_goods,''),' ',COALESCE(s.hs_code,''),' ',COALESCE(s.origin_country,''),' ',COALESCE(s.destination_port,'')) AS text,
      json_build_object('shipment_reference',s.shipment_reference,'tracking_ref',s.tracking_ref,'hs_code',s.hs_code,'destination_port',s.destination_port) AS meta
      FROM shipments s WHERE ${where} ORDER BY s.created_at DESC LIMIT ${perType}`;
    const r = await pool.query(sql, params);
    results.push(...r.rows);
  }
  if (useTypes.includes("declaration")) {
    const params = [];
    let where = `(
      d.declaration_no ILIKE $1 OR d.status ILIKE $1 OR d.customs_station ILIKE $1 OR s.shipment_reference ILIKE $1 OR i.company_name ILIKE $1
    )`;
    params.push(like);
    if (decl_status) { params.push(`%${decl_status}%`); where += ` AND d.status ILIKE $${params.length}`; }
    if (station) { params.push(`%${station}%`); where += ` AND d.customs_station ILIKE $${params.length}`; }
    if (from) { params.push(from); where += ` AND (d.created_at IS NULL OR d.created_at >= $${params.length})`; }
    if (to) { params.push(to); where += ` AND (d.created_at IS NULL OR d.created_at <= $${params.length})`; }
    if (decNo) { params.push(decNo); where += ` AND d.declaration_no = $${params.length}`; }
    const sql = `SELECT 'declaration' AS entity_type, d.declaration_id AS entity_id,
      CONCAT('Declaration ', COALESCE(d.declaration_no,''),' ',COALESCE(d.status,''),' ',COALESCE(d.customs_station,''),' ',COALESCE(s.shipment_reference,''),' ',COALESCE(i.company_name,'')) AS text,
      json_build_object('declaration_no',d.declaration_no,'status',d.status,'customs_station',d.customs_station,'shipment_reference',s.shipment_reference,'importer',i.company_name) AS meta
      FROM declarations d LEFT JOIN shipments s ON s.shipment_id = d.shipment_id LEFT JOIN importers i ON i.importer_id = s.importer_id WHERE ${where} ORDER BY d.created_at DESC LIMIT ${perType}`;
    const r = await pool.query(sql, params);
    results.push(...r.rows);
  }
  if (useTypes.includes("importer")) {
    const params = [like];
    if (impName) { params.push(impName); }
    const sql = `SELECT 'importer' AS entity_type, importer_id AS entity_id,
      CONCAT(COALESCE(company_name,''),' ',COALESCE(tin_number,''),' ',COALESCE(contact_email,''),' ',COALESCE(contact_phone,'')) AS text,
      json_build_object('company_name',company_name,'tin_number',tin_number,'contact_email',contact_email,'contact_phone',contact_phone) AS meta
      FROM importers WHERE company_name ILIKE $1 OR tin_number ILIKE $1 OR contact_email ILIKE $1 OR contact_phone ILIKE $1${impName ? ' OR company_name = $2' : ''}
      ORDER BY created_at DESC LIMIT ${perType}`;
    const r = await pool.query(sql, params);
    results.push(...r.rows);
  }
  if (useTypes.includes("document")) {
    const params = [like];
    if (docName) { params.push(docName); }
    const sql = `SELECT 'document' AS entity_type, document_id AS entity_id,
      CONCAT(COALESCE(title,''),' ',COALESCE(file_name,''),' ',COALESCE(file_type,'')) AS text,
      json_build_object('title',title,'file_name',file_name,'file_type',file_type,'file_path',file_path) AS meta
      FROM documents WHERE title ILIKE $1 OR file_name ILIKE $1 OR file_type ILIKE $1${docName ? ' OR file_name = $2' : ''}
      ORDER BY uploaded_at DESC NULLS LAST LIMIT ${perType}`;
    const r = await pool.query(sql, params);
    results.push(...r.rows);
  }
  if (useTypes.includes("device")) {
    const params = [like];
    if (deviceId) { params.push(deviceId); }
    const sql = `SELECT 'device' AS entity_type, device_id AS entity_id,
      CONCAT(COALESCE(device_id,''),' ',COALESCE(transport_company,''),' ',COALESCE(driver_name,''),' ',COALESCE(driver_phone,''),' ',COALESCE(container_no,'')) AS text,
      json_build_object('device_id',device_id,'transport_company',transport_company,'driver_name',driver_name,'driver_phone',driver_phone,'container_no',container_no,'shipment_id',shipment_id) AS meta
      FROM gps_devices WHERE device_id ILIKE $1 OR transport_company ILIKE $1 OR driver_name ILIKE $1 OR driver_phone ILIKE $1 OR container_no ILIKE $1${deviceId ? ' OR device_id = $2' : ''}
      ORDER BY registered_at DESC NULLS LAST LIMIT ${perType}`;
    const r = await pool.query(sql, params);
    results.push(...r.rows);
  }
  if (useTypes.includes("tracking")) {
    const r = await pool.query(`SELECT 'tracking' AS entity_type, shipment_id AS entity_id, CONCAT(COALESCE(shipment_id::text,''),' ',COALESCE(vessel_name,'')) AS text, json_build_object('shipment_id',shipment_id,'vessel_name',vessel_name,'last_seen',last_seen) AS meta FROM tracking WHERE vessel_name ILIKE $1 ORDER BY last_seen DESC NULLS LAST LIMIT $2`, [like, perType]);
    results.push(...r.rows);
  }

  const qv = String(q || '').trim().toLowerCase();
  const scored = results.map((r) => {
    let exact = 0;
    try {
      if (r.entity_type === 'declaration' && r.meta?.declaration_no?.toLowerCase() === qv) exact = 4;
      if (r.entity_type === 'shipment' && (r.meta?.shipment_reference?.toLowerCase() === qv || r.meta?.tracking_ref?.toLowerCase() === qv)) exact = 4;
      if (r.entity_type === 'importer' && (r.meta?.company_name?.toLowerCase() === qv || r.meta?.tin_number?.toLowerCase() === qv)) exact = 3;
      if (r.entity_type === 'document' && (r.meta?.file_name?.toLowerCase() === qv || r.meta?.title?.toLowerCase() === qv)) exact = 2;
      if (r.entity_type === 'device' && (r.meta?.device_id?.toLowerCase() === qv || r.meta?.container_no?.toLowerCase() === qv)) exact = 4;
      if (r.entity_type === 'tracking' && String(r.meta?.shipment_id || '').toLowerCase() === qv) exact = 3;
    } catch {}
    return { ...r, _exact: exact };
  });
  scored.sort((a,b)=> (b._exact||0) - (a._exact||0));
  const sliced = scored.slice(offset, offset + limit).map(({ _exact, ...rest }) => rest);
  return sliced;
}

export const smartSearch = async (req, res) => {
  try {
    const { q, types, page = 1, size, origin, destination, decl_status, station, date_from, date_to } = req.query || {};
    const tlist = (types || '').split(',').filter(Boolean);
    const sz = Number(size) || 50;
    const pg = Math.max(1, Number(page) || 1);
    const offset = (pg - 1) * sz;
    const px = parsePrefixes(q);
    const filters = {
      origin: origin || undefined,
      destination: destination || undefined,
      decl_status: decl_status || undefined,
      station: station || undefined,
      from: date_from || undefined,
      to: date_to || undefined,
      decNo: px.decNo,
      shipRef: px.shipRef,
      impName: px.impName,
      docName: px.docName,
      deviceId: px.deviceId,
      trackRef: px.trackRef,
      hsCode: px.hsCode,
    };

    // If SMART/SEARCH not enabled, serve a simple DB-backed search so the page still works
    if (!env.smart?.enabled || !env.smart?.searchEnabled) {
      const counts = await fallbackCounts({ q: px.q, types: tlist });
      const fb = await fallbackSearch({ q: px.q, types: tlist, limit: sz, offset, filters });
      return res.json({ items: fb, total: counts.total, page: pg, size: sz, byType: counts });
    }

    // Ensure index is populated at least once (lightweight backfill)
    try {
      const cnt = await pool.query(`SELECT COUNT(1) AS cnt FROM smart_index`);
      if (Number(cnt.rows[0]?.cnt || 0) === 0) {
        // Index recent declarations, shipments, importers, documents
        const decl = await pool.query(`SELECT declaration_id, declaration_no FROM declarations ORDER BY created_at DESC LIMIT 300`);
        for (const d of decl.rows) {
          const text = `declaration ${d.declaration_no}`;
          await SmartIndex.upsert({ entity_type: 'declaration', entity_id: d.declaration_id, text, embedding: embedText(text) });
        }
        const ships = await pool.query(`SELECT shipment_id, shipment_reference, description_of_goods FROM shipments ORDER BY created_at DESC LIMIT 300`);
        for (const s of ships.rows) {
          const text = `${s.shipment_reference} ${s.description_of_goods || ''}`;
          await SmartIndex.upsert({ entity_type: 'shipment', entity_id: s.shipment_id, text, embedding: embedText(text) });
        }
        const imps = await pool.query(`SELECT importer_id, company_name, tin_number FROM importers ORDER BY created_at DESC LIMIT 300`);
        for (const i of imps.rows) {
          const text = `${i.company_name || ''} ${i.tin_number || ''}`;
          await SmartIndex.upsert({ entity_type: 'importer', entity_id: i.importer_id, text, embedding: embedText(text) });
        }
        const docs = await pool.query(`SELECT document_id, title, file_name, file_type FROM documents ORDER BY uploaded_at DESC NULLS LAST LIMIT 300`);
        for (const d of docs.rows) {
          const text = `${d.title || ''} ${d.file_name || ''} ${d.file_type || ''}`;
          await SmartIndex.upsert({ entity_type: 'document', entity_id: d.document_id, text, embedding: embedText(text) });
        }
      }
    } catch {}

    let list = await SmartIndex.search({ q: px.q, types: tlist, limit: sz });
    // Apply semantic post-filtering using SQL fallback filters
    const hasFilters = Object.values(filters).some((v) => v != null);
    if (hasFilters) {
      try {
        const filtered = await fallbackSearch({ q: px.q, types: tlist, limit: Math.max(500, sz), offset: 0, filters });
        const allow = new Set(filtered.map((r) => `${r.entity_type}:${r.entity_id}`));
        list = list.filter((r) => allow.has(`${r.entity_type}:${r.entity_id}`));
      } catch {}
    }
    const counts = await fallbackCounts({ q: px.q, types: tlist });
    res.json({ items: list, total: counts.total || list.length, page: pg, size: sz, byType: counts });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const smartIndexRebuild = async (_req, res) => {
  if (guardEnabled(res, 'enabled')) return;
  try {
    let count = 0;
    const decl = await pool.query(`SELECT declaration_id, declaration_no FROM declarations ORDER BY created_at DESC LIMIT 500`);
    for (const d of decl.rows) {
      const text = `declaration ${d.declaration_no}`;
      await SmartIndex.upsert({ entity_type: 'declaration', entity_id: d.declaration_id, text, embedding: embedText(text) });
      count++;
    }
    const ships = await pool.query(`SELECT shipment_id, shipment_reference, description_of_goods FROM shipments ORDER BY created_at DESC LIMIT 500`);
    for (const s of ships.rows) {
      const text = `${s.shipment_reference} ${s.description_of_goods || ''}`;
      await SmartIndex.upsert({ entity_type: 'shipment', entity_id: s.shipment_id, text, embedding: embedText(text) });
      count++;
    }
    res.json({ ok: true, indexed: count });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const smartSuggestHs = async (req, res) => {
  if (guardEnabled(res, 'enabled')) return;
  try {
    const { description } = req.body || {};
    res.json(suggestHs({ description }));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const smartEstimateValue = async (req, res) => {
  if (guardEnabled(res, 'enabled')) return;
  try {
    const { hs_code, quantity, unit } = req.body || {};
    res.json(estimateValue({ hs_code, quantity, unit }));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const smartOcrExtract = async (req, res) => {
  try {
    const { document_id, file_name } = req.body || {};
    if (!document_id) return res.status(400).json({ message: 'document_id required' });
    const doc = await Document.getById(document_id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const out = await extractFields({
      document_id,
      file_name: file_name || doc.file_name,
      title: doc.title,
      file_type: doc.file_type,
      file_size: doc.file_size,
      file_path: doc.file_path,
      ocr_enabled: !!env.smart?.ocrEnabled,
    });
    const saved = await OcrExtract.insert({ document_id, fields: out.fields, confidence: out.confidence });
    res.json(saved);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// CSV export for Smart Search (mirrors filters and result set as closely as possible)
export const smartSearchCsv = async (req, res) => {
  try {
    const { q, types, page = 1, size, origin, destination, decl_status, station, date_from, date_to } = req.query || {};
    const tlist = (types || '').split(',').filter(Boolean);
    const sz = Math.min(5000, Number(size) || 5000);
    const px = parsePrefixes(q);
    const filters = {
      origin: origin || undefined,
      destination: destination || undefined,
      decl_status: decl_status || undefined,
      station: station || undefined,
      from: date_from || undefined,
      to: date_to || undefined,
      decNo: px.decNo,
      shipRef: px.shipRef,
      impName: px.impName,
      docName: px.docName,
      deviceId: px.deviceId,
      trackRef: px.trackRef,
      hsCode: px.hsCode,
    };

    let items = [];
    if (!env.smart?.enabled || !env.smart?.searchEnabled) {
      const counts = await fallbackCounts({ q: px.q, types: tlist, filters });
      const lim = Math.min(sz, Number(counts.total || 0) || sz);
      items = await fallbackSearch({ q: px.q, types: tlist, limit: lim, offset: 0, filters });
    } else {
      // Smart results, then post-filter by SQL to respect filters
      const base = await SmartIndex.search({ q: px.q, types: tlist, limit: sz });
      const filtered = await fallbackSearch({ q: px.q, types: tlist, limit: sz, offset: 0, filters });
      const allow = new Set(filtered.map((r) => `${r.entity_type}:${r.entity_id}`));
      items = base.filter((r) => allow.has(`${r.entity_type}:${r.entity_id}`));
    }

    const headers = ['entity_type', 'entity_id', 'text', 'meta'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(',')];
    for (const it of items) {
      const meta = it.meta ? JSON.stringify(it.meta) : '';
      lines.push([it.entity_type, it.entity_id, it.text || '', meta].map(esc).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="smart-search.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
