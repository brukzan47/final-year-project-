import { env } from "../config/env.js";

function enabled() { return !!env.singleWindow?.nbe?.enabled && !!env.singleWindow?.nbe?.baseUrl; }

export async function requestApproval({ declaration_id, currency, amount_usd }) {
  if (!enabled()) {
    return { ok: true, mock: true, request_ref: `NBE-MOCK-${Date.now()}`, status: "Pending" };
  }
  // TODO: Implement OAuth2 client credentials and call NBE endpoint
  // Placeholder stub to avoid runtime failures without credentials
  return { ok: true, request_ref: `NBE-${Date.now()}`, status: "Pending" };
}

export async function getApprovalStatus({ request_ref }) {
  if (!enabled()) {
    return { ok: true, mock: true, request_ref, status: "Approved" };
  }
  // TODO: GET status from NBE
  return { ok: true, request_ref, status: "Approved" };
}

