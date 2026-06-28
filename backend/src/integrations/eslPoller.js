import { env } from "../config/env.js";
import { Shipment } from "../models/Shipment.js";
import { Tracking } from "../models/Tracking.js";

// Poll ESL API for positions and update tracking table
export function startEslPoller(logger) {
  const cfg = env.tracking?.esl || {};
  if (!cfg.enabled || !cfg.baseUrl) {
    logger?.info?.("ESL poller disabled");
    return { stop() {} };
  }
  const interval = Math.max(15, Number(cfg.pollingSec || 60)) * 1000;
  let timer = null;
  let stopped = false;

  async function tick() {
    try {
      const shipments = await Shipment.getAll();
      for (const s of shipments) {
        if (!s.shipment_reference) continue;
        const ref = s.tracking_ref || s.shipment_reference;
        const url = `${cfg.baseUrl.replace(/\/$/, '')}/track?ref=${encodeURIComponent(ref)}`;
        const headers = {};
        if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;
        let json = null;
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) continue;
          json = await res.json();
        } catch {
          continue; // skip on network errors
        }

        // Map provider payload -> our fields; adjust if schema differs
        const data = {
          lat: json?.lat ?? json?.latitude ?? null,
          lon: json?.lon ?? json?.longitude ?? null,
          speed: json?.speed ?? null,
          heading: json?.heading ?? null,
          vessel_name: json?.vessel_name ?? json?.vessel ?? null,
          last_seen: json?.timestamp ? new Date(json.timestamp) : new Date(),
          eta_delivery: json?.eta ? new Date(json.eta) : null,
          customs_status: json?.customs_status ?? null,
          clearance_progress: json?.clearance_progress ?? null,
          extra: json,
        };
        await Tracking.upsert(s.shipment_id, data);
      }
    } catch (e) {
      logger?.error?.(`ESL poller tick failed: ${e.message}`);
    } finally {
      if (!stopped) timer = setTimeout(tick, interval);
    }
  }

  timer = setTimeout(tick, 2000);
  logger?.info?.(`ESL poller started (every ${interval/1000}s)`);

  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
  };
}
