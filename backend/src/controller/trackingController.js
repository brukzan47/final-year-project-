import { Tracking } from "../models/Tracking.js";
import { TrackingPoint } from "../models/TrackingPoint.js";
import { pool } from "../config/db.js";
import { hmacValid } from "../utils/webhookVerify.js";
import { env } from "../config/env.js";
import { Shipment } from "../models/Shipment.js";
import { GpsDevice } from "../models/GpsDevice.js";
import { notifyImporterByShipment, notifyOfficers } from "../utils/notify.js";

// In-memory SSE subscribers keyed by shipment_id
const subscribers = new Map(); // shipment_id -> Set(res)
const resTimers = new WeakMap();

function deg2rad(d) { return (Number(d) * Math.PI) / 180; }

function predictPosition(row) {
  try {
    const lat = Number(row.lat), lon = Number(row.lon);
    const speed = Number(row.speed); // knots
    const heading = Number(row.heading); // degrees, 0=N
    const last = row.last_seen ? new Date(row.last_seen) : null;
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(speed) || !isFinite(heading) || !last) return null;
    const dtH = (Date.now() - last.getTime()) / 3600000;
    if (dtH <= 0) return null;
    const distKm = speed * 1.852 * dtH;
    const hdg = deg2rad(heading);
    const dLat = (distKm * Math.cos(hdg)) / 111;
    const dLon = (distKm * Math.sin(hdg)) / (111 * Math.max(0.1, Math.cos(deg2rad(lat))));
    return {
      lat: lat + dLat,
      lon: lon + dLon,
      predicted: true,
      predicted_at: new Date().toISOString(),
      stale_minutes: Math.round(dtH * 60),
    };
  } catch {
    return null;
  }
}

function pushUpdate(shipment_id, payload) {
  const set = subscribers.get(shipment_id);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch {}
  }
}

function toRad(deg) { return (Number(deg) * Math.PI) / 180; }

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function lookupLocationByName(name) {
  if (!name) return null;
  const r = await pool.query(`SELECT name, lat, lon FROM locations WHERE name=$1 LIMIT 1`, [name]);
  if (!r.rowCount) return null;
  return { name: r.rows[0].name, lat: Number(r.rows[0].lat), lon: Number(r.rows[0].lon) };
}

async function notifyEvent({ shipment_id, title, message }) {
  try {
    await notifyOfficers({ title, message });
    await notifyImporterByShipment({ shipment_id, title, message });
  } catch {}
}

export const getTracking = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const base = await Tracking.getByShipment(shipmentId);

    const q = `
      SELECT
        (SELECT inspection_result FROM inspections i
          JOIN declarations d ON d.declaration_id = i.declaration_id
         WHERE d.shipment_id = $1
         ORDER BY i.inspection_date DESC NULLS LAST, i.created_at DESC NULLS LAST
         LIMIT 1) AS inspection_status,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 100 ELSE 0 END FROM clearances c
          JOIN declarations d ON d.declaration_id = c.declaration_id
         WHERE d.shipment_id = $1) AS clearance_progress,
        (SELECT MIN(release_date) FROM clearances c
          JOIN declarations d ON d.declaration_id = c.declaration_id
         WHERE d.shipment_id = $1) AS clearance_release_date
    `;
    const r = await pool.query(q, [shipmentId]);
    const enrich = r.rows[0] || {};

    const result = {
      shipment_id: shipmentId,
      lat: base?.lat ?? null,
      lon: base?.lon ?? null,
      speed: base?.speed ?? null,
      heading: base?.heading ?? null,
      vessel_name: base?.vessel_name ?? null,
      last_seen: base?.last_seen ?? null,
      eta_delivery: base?.eta_delivery ?? null,
      customs_status: base?.customs_status ?? enrich.inspection_status ?? null,
      clearance_progress: base?.clearance_progress ?? Number(enrich.clearance_progress || 0),
      clearance_release_date: enrich.clearance_release_date ?? null,
    };

    try {
      const pred = predictPosition(result);
      if (pred) {
        result.lat = pred.lat;
        result.lon = pred.lon;
        result.predicted = true;
        result.predicted_at = pred.predicted_at;
        result.stale_minutes = pred.stale_minutes;
      }

      const ship = await pool.query(`SELECT destination_port FROM shipments WHERE shipment_id=$1`, [shipmentId]);
      const destName = ship.rows[0]?.destination_port || null;
      if (destName && result.lat != null && result.lon != null) {
        const dest = await lookupLocationByName(destName);
        if (dest) {
          const firstQ = await pool.query(
            `SELECT lat, lon FROM tracking_points WHERE shipment_id=$1 ORDER BY seen_at ASC LIMIT 1`,
            [shipmentId]
          );
          const first = firstQ.rowCount ? { lat: Number(firstQ.rows[0].lat), lon: Number(firstQ.rows[0].lon) } : null;
          if (first) {
            const distStart = haversineKm(first, dest);
            const distNow = haversineKm({ lat: Number(result.lat), lon: Number(result.lon) }, dest);
            if (isFinite(distStart) && distStart > 1 && isFinite(distNow)) {
              result.route_progress = Math.max(0, Math.min(100, Math.round((1 - (distNow / distStart)) * 100)));
            }
          }
        }
      }
    } catch {}

    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const sseStream = async (req, res) => {
  const { shipmentId } = req.params;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write("retry: 15000\n\n");
  if (!res.getHeader("Access-Control-Allow-Origin")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.flushHeaders?.();

  let set = subscribers.get(shipmentId);
  if (!set) { set = new Set(); subscribers.set(shipmentId, set); }
  set.add(res);

  try {
    const snapshot = await Tracking.getByShipment(shipmentId);
    if (snapshot) {
      const pred = predictPosition(snapshot) || {};
      const first = { ...snapshot, ...(pred || {}) };
      res.write(`data: ${JSON.stringify(first)}\n\n`);
    }
  } catch {}

  const t = setInterval(async () => {
    try {
      const cur = await Tracking.getByShipment(shipmentId);
      if (cur) {
        const pred = predictPosition(cur);
        const out = pred ? { ...cur, ...pred } : cur;
        res.write(`data: ${JSON.stringify(out)}\n\n`);
      } else {
        res.write(`:heartbeat ${Date.now()}\n\n`);
      }
    } catch {}
  }, 15000);
  resTimers.set(res, t);

  req.on("close", () => {
    const curr = subscribers.get(shipmentId);
    if (curr) {
      curr.delete(res);
      if (curr.size === 0) subscribers.delete(shipmentId);
    }
    try { const tt = resTimers.get(res); if (tt) clearInterval(tt); } catch {}
  });
};

export const updateTracking = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const prev = await Tracking.getByShipment(shipmentId);
    const {
      lat, lon, speed, heading, vessel_name, eta_delivery,
      customs_status, clearance_progress, extra,
    } = req.body || {};

    const row = await Tracking.upsert(shipmentId, {
      lat: lat != null ? Number(lat) : null,
      lon: lon != null ? Number(lon) : null,
      speed: speed != null ? Number(speed) : null,
      heading: heading != null ? Number(heading) : null,
      vessel_name: vessel_name || null,
      last_seen: new Date(),
      eta_delivery: eta_delivery ? new Date(eta_delivery) : null,
      customs_status: customs_status || null,
      clearance_progress: clearance_progress != null ? Number(clearance_progress) : null,
      extra: extra || null,
    });

    try {
      if (row?.lat != null && row?.lon != null) {
        await TrackingPoint.insert({
          shipment_id: shipmentId,
          lat: row.lat,
          lon: row.lon,
          speed: row.speed,
          heading: row.heading,
          predicted: false,
          seen_at: row.last_seen,
        });
      }
    } catch {}

    try {
      if (!prev && row?.lat != null && row?.lon != null) {
        const locs = await pool.query(`SELECT name, lat, lon FROM locations`);
        let nearest = null;
        let best = Infinity;
        for (const L of locs.rows) {
          const d = haversineKm({ lat: Number(row.lat), lon: Number(row.lon) }, { lat: Number(L.lat), lon: Number(L.lon) });
          if (isFinite(d) && d < best) { best = d; nearest = L.name; }
        }
        const nearName = nearest || "origin";
        await notifyEvent({
          shipment_id: shipmentId,
          title: { en: "Container Departed", am: "\u12ae\u1295\u1274\u1290\u1229 \u1270\u1290\u1233" },
          message: { en: `Departed ${nearName}`, am: `${nearName} \u12a8\u1270\u1263\u1208\u12cd \u1266\u1273 \u1270\u1290\u1235\u1277\u120d` },
        });
      }

      const shipInfo = await pool.query(`SELECT destination_port FROM shipments WHERE shipment_id=$1`, [shipmentId]);
      const destName = shipInfo.rows[0]?.destination_port || null;
      const dest = await lookupLocationByName(destName);
      if (row?.lat != null && row?.lon != null && dest) {
        const km = haversineKm({ lat: Number(row.lat), lon: Number(row.lon) }, dest);
        const speedKmh = isFinite(Number(row.speed)) ? Number(row.speed) * 1.852 : NaN;
        const etaMs = (isFinite(km) && isFinite(speedKmh) && speedKmh > 1) ? (km / speedKmh) * 3600000 : null;
        if (etaMs != null) {
          const eta = new Date(Date.now() + etaMs);
          const prevEta = prev?.eta_delivery ? new Date(prev.eta_delivery) : null;
          if (!prevEta || Math.abs(eta.getTime() - prevEta.getTime()) > 30 * 60000) {
            await Tracking.upsert(shipmentId, { eta_delivery: eta });
            await notifyEvent({
              shipment_id: shipmentId,
              title: { en: "ETA Updated", am: "ETA \u1270\u12d8\u121d\u1297\u120d" },
              message: {
                en: `ETA updated for shipment ${shipmentId} to ${eta.toLocaleString()}`,
                am: `\u12e8\u132d\u1290\u1275 ${shipmentId} \u12e8\u1218\u12f5\u1228\u123b \u130a\u12dc \u12c8\u12f0 ${eta.toLocaleString()} \u1270\u12d8\u121d\u1297\u120d`,
              },
            });
          }
        }

        if (isFinite(km) && km < 3 && isFinite(speedKmh) && speedKmh < 5) {
          const already = prev?.extra && prev.extra.arrived_notified;
          if (!already) {
            const extraFlags = Object.assign({}, prev?.extra || {}, { arrived_notified: true });
            await Tracking.upsert(shipmentId, { extra: extraFlags, customs_status: "Arrived" });
            await notifyEvent({
              shipment_id: shipmentId,
              title: { en: "Arrival", am: "\u1218\u12f5\u1228\u1235" },
              message: { en: `Shipment reached ${destName}`, am: `\u132d\u1290\u1271 ${destName} \u12f0\u122d\u1237\u120d` },
            });
          }
        }
      }
    } catch {}

    pushUpdate(shipmentId, row);
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const eslWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-signature"] || req.headers["x-esl-signature"];
    if (!hmacValid({ body: req.body, secret: env.tracking?.esl?.webhookSecret, signature })) {
      return res.status(401).json({ message: "invalid signature" });
    }
    const ref = req.body?.reference || req.body?.tracking_ref || req.body?.shipment_reference;
    if (!ref) return res.status(400).json({ message: "missing reference" });
    const ship = await Shipment.getByReference(ref);
    if (!ship) return res.status(404).json({ message: "shipment not found" });

    const row = await Tracking.upsert(ship.shipment_id, {
      lat: req.body?.lat ?? null,
      lon: req.body?.lon ?? null,
      speed: req.body?.speed ?? null,
      heading: req.body?.heading ?? null,
      vessel_name: req.body?.vessel_name ?? null,
      last_seen: new Date(),
      eta_delivery: req.body?.eta_delivery ? new Date(req.body.eta_delivery) : null,
      customs_status: req.body?.customs_status ?? null,
      clearance_progress: req.body?.clearance_progress ?? null,
      extra: req.body || null,
    });
    try {
      if (row?.lat != null && row?.lon != null) {
        await TrackingPoint.insert({ shipment_id: ship.shipment_id, lat: row.lat, lon: row.lon, speed: row.speed, heading: row.heading, predicted: false, seen_at: row.last_seen });
      }
    } catch {}
    pushUpdate(ship.shipment_id, row);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getTrail = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const limit = Number(req.query.limit || 50);
    const rows = await TrackingPoint.listByShipment(shipmentId, limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const listLocations = async (_req, res) => {
  try {
    const r = await pool.query(`SELECT name, type, lat, lon FROM locations ORDER BY name ASC`);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const demoSimulate = async (req, res) => {
  try {
    const { shipment_id } = req.body || {};
    if (!shipment_id) return res.status(400).json({ message: "shipment_id is required" });
    const shipQ = await pool.query(`SELECT destination_port FROM shipments WHERE shipment_id=$1`, [shipment_id]);
    if (shipQ.rowCount === 0) return res.status(404).json({ message: "shipment not found" });
    const destName = shipQ.rows[0]?.destination_port || null;
    const dest = await lookupLocationByName(destName);
    const cur = await Tracking.getByShipment(shipment_id);
    if (!cur || cur.lat == null || cur.lon == null || !dest) {
      return res.status(400).json({ message: "missing current position or destination" });
    }

    const lat = Number(cur.lat), lon = Number(cur.lon);
    const target = { lat: Number(dest.lat), lon: Number(dest.lon) };
    const next = {
      lat: lat + (target.lat - lat) * 0.15,
      lon: lon + (target.lon - lon) * 0.15,
    };

    const row = await Tracking.upsert(shipment_id, {
      lat: next.lat,
      lon: next.lon,
      speed: cur.speed ?? 12,
      heading: cur.heading ?? 90,
      vessel_name: cur.vessel_name || null,
      last_seen: new Date(),
      customs_status: cur.customs_status || null,
      clearance_progress: cur.clearance_progress ?? null,
      extra: cur.extra || null,
    });
    try { await TrackingPoint.insert({ shipment_id, lat: next.lat, lon: next.lon, speed: row.speed, heading: row.heading, predicted: false, seen_at: row.last_seen }); } catch {}
    pushUpdate(shipment_id, row);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const demoArrive = async (req, res) => {
  try {
    const { shipment_id } = req.body || {};
    if (!shipment_id) return res.status(400).json({ message: "shipment_id is required" });
    const shipQ = await pool.query(`SELECT destination_port FROM shipments WHERE shipment_id=$1`, [shipment_id]);
    if (shipQ.rowCount === 0) return res.status(404).json({ message: "shipment not found" });
    const destName = shipQ.rows[0]?.destination_port || null;
    const dest = await lookupLocationByName(destName);
    if (!dest) return res.status(400).json({ message: "destination not found in locations" });

    const row = await Tracking.upsert(shipment_id, {
      lat: Number(dest.lat),
      lon: Number(dest.lon),
      speed: 0,
      heading: 0,
      last_seen: new Date(),
      customs_status: "Arrived",
      extra: { arrived_notified: true },
    });
    try { await TrackingPoint.insert({ shipment_id, lat: Number(dest.lat), lon: Number(dest.lon), speed: row.speed, heading: row.heading, predicted: false, seen_at: row.last_seen }); } catch {}
    try {
      await notifyEvent({
        shipment_id,
        title: { en: "Arrival", am: "\u1218\u12f5\u1228\u1235" },
        message: { en: `Shipment reached ${destName}`, am: `\u132d\u1290\u1271 ${destName} \u12f0\u122d\u1237\u120d` },
      });
    } catch {}
    pushUpdate(shipment_id, row);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const gpsIngest = async (req, res) => {
  try {
    const secret = String(env.tracking?.gps?.ingestSecret || "").trim();
    if (secret) {
      const provided = String(req.headers["x-gps-secret"] || "").trim();
      if (!provided || provided !== secret) return res.status(401).json({ message: "invalid secret" });
    }

    const body = req.body || {};
    const ref = body.reference || body.tracking_ref || body.shipment_reference || null;
    const deviceId = body.device_id || null;
    const containerNo = body.container_no || null;

    let shipmentId = null;
    if (ref) {
      const s = await Shipment.getByReference(String(ref).toUpperCase());
      if (s) shipmentId = s.shipment_id;
    }

    if (!shipmentId && deviceId) {
      const dev = await GpsDevice.getById(deviceId);
      shipmentId = dev?.shipment_id || null;
      if (!shipmentId && containerNo) {
        const qs = await pool.query(`SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1`, [containerNo]);
        if (qs.rowCount) shipmentId = qs.rows[0].shipment_id;
      }
    }

    if (!shipmentId && containerNo) {
      const qs = await pool.query(`SELECT shipment_id FROM shipments WHERE shipment_reference=$1 LIMIT 1`, [containerNo]);
      if (qs.rowCount) shipmentId = qs.rows[0].shipment_id;
    }

    if (!shipmentId) return res.status(404).json({ message: "shipment not resolved" });

    const row = await Tracking.upsert(shipmentId, {
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
      vessel_name: body.vessel_name ?? null,
      last_seen: new Date(),
      eta_delivery: body.eta_delivery ? new Date(body.eta_delivery) : null,
      customs_status: body.customs_status ?? null,
      clearance_progress: body.clearance_progress ?? null,
      extra: body || null,
    });
    try {
      if (row?.lat != null && row?.lon != null) {
        await TrackingPoint.insert({ shipment_id: shipmentId, lat: row.lat, lon: row.lon, speed: row.speed, heading: row.heading, predicted: false, seen_at: row.last_seen });
      }
    } catch {}
    pushUpdate(shipmentId, row);
    return res.json({ ok: true, shipment_id: shipmentId });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const registerDevice = async (req, res) => {
  try {
    const { device_id, shipment_id, container_no, transport_company, driver_name, driver_phone, active } = req.body || {};
    if (!device_id) return res.status(400).json({ message: "device_id is required" });
    const row = await GpsDevice.register({ device_id, shipment_id, container_no, transport_company, driver_name, driver_phone, active });
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const listDevices = async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT gd.*,
             t.last_seen,
             t.lat,
             t.lon,
             s.shipment_reference,
             s.destination_port
      FROM gps_devices gd
      LEFT JOIN tracking t ON t.shipment_id = gd.shipment_id
      LEFT JOIN shipments s ON s.shipment_id = gd.shipment_id
      ORDER BY gd.registered_at DESC
    `);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
