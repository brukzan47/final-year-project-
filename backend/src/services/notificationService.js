import { pool } from "../config/db.js";
import { Notification } from "../models/Notification.js";
import { publishUserNotification } from "./notificationRealtime.js";
import { sendMail } from "../utils/mailer.js";
import { sendSms } from "../utils/sms.js";

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean).map(String))];
}

function normalizeLanguage(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "am" ? "am" : "en";
}

function localizedText(value, preferredLanguage) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const lang = normalizeLanguage(preferredLanguage);
    if (lang === "am" && value.am) return String(value.am);
    if (value.en) return String(value.en);
    const first = Object.values(value).find((x) => x != null);
    return first == null ? "" : String(first);
  }
  return String(value || "");
}

export async function usersByRoles(roles = []) {
  const r = uniq(roles);
  if (!r.length) return [];
  const q = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, COALESCE(u.preferred_language, 'en') AS preferred_language, r.role_name
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.status='active' AND r.role_name = ANY($1::text[])`,
    [r]
  );
  return q.rows || [];
}

export async function importerUserByDeclaration(declarationId) {
  if (!declarationId) return null;
  const q = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, COALESCE(u.preferred_language, 'en') AS preferred_language, i.importer_id, i.contact_phone
     FROM declarations d
     JOIN shipments s ON s.shipment_id = d.shipment_id
     JOIN importers i ON i.importer_id = s.importer_id
     JOIN users u ON lower(u.email) = lower(i.contact_email)
     JOIN roles r ON r.role_id = u.role_id AND r.role_name='Importer'
     WHERE d.declaration_id = $1 AND u.status='active'
     LIMIT 1`,
    [declarationId]
  );
  return q.rows?.[0] || null;
}

export async function importerUserByShipment(shipmentId) {
  if (!shipmentId) return null;
  const q = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, COALESCE(u.preferred_language, 'en') AS preferred_language, i.importer_id, i.contact_phone
     FROM shipments s
     JOIN importers i ON i.importer_id = s.importer_id
     JOIN users u ON lower(u.email) = lower(i.contact_email)
     JOIN roles r ON r.role_id = u.role_id AND r.role_name='Importer'
     WHERE s.shipment_id = $1 AND u.status='active'
     LIMIT 1`,
    [shipmentId]
  );
  return q.rows?.[0] || null;
}

async function deliverOutOfBand(user, title, message, channels = []) {
  try {
    if (channels.includes("EMAIL") && user?.email) {
      await sendMail({ to: user.email, subject: title, text: message });
    }
  } catch {}
  try {
    if (channels.includes("SMS") && user?.contact_phone) {
      await sendSms({ to: user.contact_phone, message: `${title}: ${message}` });
    }
  } catch {}
}

export async function createNotification({
  userId,
  title,
  message,
  category = "SYSTEM",
  type = "INFO",
  referenceId = null,
  eventKey = null,
  channels = ["IN_APP"],
  metadata = null,
  roles = null,
  importerId = null,
  declarationId = null,
  outOfBandUser = null,
}) {
  if (!userId || !title || !message) return null;
  const row = await Notification.createForUser({
    user_id: userId,
    title,
    message,
    category,
    type,
    reference_id: referenceId,
    event_key: eventKey,
    channels,
    metadata,
    roles,
    importer_id: importerId,
    declaration_id: declarationId,
  });
  if (!row) return null;
  publishUserNotification(userId, row);
  await deliverOutOfBand(outOfBandUser || null, title, message, channels);
  return row;
}

export async function notifyRoleGroup({
  roles = [],
  title,
  message,
  category = "SYSTEM",
  type = "INFO",
  referenceId = null,
  eventKeyPrefix = null,
  channels = ["IN_APP"],
  metadata = null,
}) {
  const users = await usersByRoles(roles);
  const created = [];
  for (const user of users) {
    const eventKey = eventKeyPrefix ? `${eventKeyPrefix}:${user.user_id}` : null;
    const lt = localizedText(title, user.preferred_language);
    const lm = localizedText(message, user.preferred_language);
    const row = await createNotification({
      userId: user.user_id,
      title: lt,
      message: lm,
      category,
      type,
      referenceId,
      eventKey,
      channels,
      metadata,
      roles,
      outOfBandUser: user,
    });
    if (row) created.push(row);
  }
  return created;
}

export async function notifyImporterByDeclaration({
  declarationId,
  title,
  message,
  category = "DECLARATION",
  type = "INFO",
  referenceId = null,
  eventKey = null,
  channels = ["IN_APP"],
}) {
  const importer = await importerUserByDeclaration(declarationId);
  if (!importer?.user_id) return null;
  const lt = localizedText(title, importer.preferred_language);
  const lm = localizedText(message, importer.preferred_language);
  return createNotification({
    userId: importer.user_id,
    title: lt,
    message: lm,
    category,
    type,
    referenceId: referenceId || declarationId || null,
    eventKey,
    channels,
    metadata: { declaration_id: declarationId || null },
    roles: ["Importer"],
    importerId: importer.importer_id || null,
    declarationId: declarationId || null,
    outOfBandUser: importer,
  });
}

export async function notifyImporterByShipment({
  shipmentId,
  title,
  message,
  category = "SHIPMENT",
  type = "INFO",
  referenceId = null,
  eventKey = null,
  channels = ["IN_APP"],
}) {
  const importer = await importerUserByShipment(shipmentId);
  if (!importer?.user_id) return null;
  const lt = localizedText(title, importer.preferred_language);
  const lm = localizedText(message, importer.preferred_language);
  return createNotification({
    userId: importer.user_id,
    title: lt,
    message: lm,
    category,
    type,
    referenceId: referenceId || shipmentId || null,
    eventKey,
    channels,
    metadata: { shipment_id: shipmentId || null },
    roles: ["Importer"],
    importerId: importer.importer_id || null,
    declarationId: null,
    outOfBandUser: importer,
  });
}
