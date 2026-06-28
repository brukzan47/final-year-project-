import { AuditLog } from "../models/AuditLog.js";

export async function audit(req, details) {
  try {
    await AuditLog.record({ req, ...details });
  } catch (err) {
    try { console.error("audit record failed:", err?.message || err); } catch {}
  }
}
