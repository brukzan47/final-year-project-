import { env } from "../config/env.js";

function enabled() { return !!env.singleWindow?.trade?.enabled && !!env.singleWindow?.trade?.baseUrl; }

export async function requestPermit({ declaration_id, goods }) {
  if (!enabled()) return { ok: true, mock: true, permit_no: `PERMIT-MOCK-${Date.now()}`, status: "Pending" };
  // TODO: POST to Ministry of Trade API
  return { ok: true, permit_no: `PERMIT-${Date.now()}`, status: "Pending" };
}

export async function getPermitStatus({ permit_no }) {
  if (!enabled()) return { ok: true, mock: true, permit_no, status: "Issued" };
  // TODO: GET permit status
  return { ok: true, permit_no, status: "Issued" };
}

