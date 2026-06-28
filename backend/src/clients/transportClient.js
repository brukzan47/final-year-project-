import { env } from "../config/env.js";

function enabled() { return !!env.singleWindow?.transport?.enabled && !!env.singleWindow?.transport?.baseUrl; }

export async function linkShipment({ shipment_id, tracking_ref }) {
  if (!enabled()) return { ok: true, mock: true, provider: "Transport", provider_ref: `TR-${Date.now()}`, status: "Linked" };
  // TODO: POST to Transport Ministry API to create link
  return { ok: true, provider: "Transport", provider_ref: `TR-${Date.now()}`, status: "Linked" };
}

export async function getLinkStatus({ provider_ref }) {
  if (!enabled()) return { ok: true, mock: true, provider_ref, status: "Linked" };
  // TODO: GET link status
  return { ok: true, provider_ref, status: "Linked" };
}

