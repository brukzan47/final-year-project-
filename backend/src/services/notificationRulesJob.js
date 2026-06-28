import { pool } from "../config/db.js";
import { notifyImporterByDeclaration, notifyRoleGroup } from "./notificationService.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function remindPendingPayments() {
  const rows = (
    await pool.query(
      `SELECT p.payment_id, p.declaration_id, d.declaration_no
       FROM payments p
       JOIN declarations d ON d.declaration_id = p.declaration_id
       WHERE p.payment_status = 'Pending'
         AND p.created_at < NOW() - INTERVAL '3 days'`
    )
  ).rows;
  for (const row of rows) {
    await notifyImporterByDeclaration({
      declarationId: row.declaration_id,
      title: { en: "Payment Reminder", am: "የክፍያ ማስታወሻ" },
      message: {
        en: `Payment is still pending for declaration ${row.declaration_no || row.declaration_id}.`,
        am: `ለመግለጫ ${row.declaration_no || row.declaration_id} ክፍያ አሁንም በተጠባባቂ ሁኔታ ነው።`,
      },
      category: "PAYMENT",
      type: "WARNING",
      referenceId: row.payment_id || row.declaration_id,
      eventKey: `reminder:payment_pending:${row.payment_id || row.declaration_id}:${todayKey()}`,
    });
  }
}

async function remindInspectionDelays() {
  const rows = (
    await pool.query(
      `SELECT d.declaration_id, d.declaration_no
       FROM declarations d
       WHERE d.created_at < NOW() - INTERVAL '5 days'
         AND NOT EXISTS (
           SELECT 1 FROM inspections i WHERE i.declaration_id = d.declaration_id
         )`
    )
  ).rows;
  for (const row of rows) {
    await notifyRoleGroup({
      roles: ["Admin"],
      title: { en: "Inspection Delay Alert", am: "የምርመራ መዘግየት ማስጠንቀቂያ" },
      message: {
        en: `Inspection delayed for declaration ${row.declaration_no || row.declaration_id}.`,
        am: `ለመግለጫ ${row.declaration_no || row.declaration_id} ምርመራ ዘግይቷል።`,
      },
      category: "INSPECTION",
      type: "ERROR",
      referenceId: row.declaration_id,
      eventKeyPrefix: `reminder:inspection_delayed:${row.declaration_id}:${todayKey()}`,
    });
  }
}

async function remindClearanceDelays() {
  const rows = (
    await pool.query(
      `SELECT d.declaration_id, d.declaration_no
       FROM declarations d
       WHERE d.created_at < NOW() - INTERVAL '2 days'
         AND EXISTS (
           SELECT 1 FROM payments p
           WHERE p.declaration_id=d.declaration_id AND p.payment_status='Paid'
         )
         AND NOT EXISTS (
           SELECT 1 FROM clearances c WHERE c.declaration_id=d.declaration_id
         )`
    )
  ).rows;
  for (const row of rows) {
    await notifyRoleGroup({
      roles: ["Admin", "Customs Officer"],
      title: { en: "Clearance Delay Escalation", am: "የክሊራንስ መዘግየት ማሳወቂያ" },
      message: {
        en: `Clearance delayed for declaration ${row.declaration_no || row.declaration_id}.`,
        am: `ለመግለጫ ${row.declaration_no || row.declaration_id} ክሊራንስ ዘግይቷል።`,
      },
      category: "CLEARANCE",
      type: "WARNING",
      referenceId: row.declaration_id,
      eventKeyPrefix: `reminder:clearance_delayed:${row.declaration_id}:${todayKey()}`,
    });
  }
}

export async function runNotificationRulesOnce(logger = console) {
  try {
    await remindPendingPayments();
    await remindInspectionDelays();
    await remindClearanceDelays();
  } catch (err) {
    try { logger?.error?.(`Notification rules failed: ${err.message}`); } catch {}
  }
}

export function startNotificationRulesJob(logger = console) {
  // Run once shortly after startup, then hourly.
  setTimeout(() => {
    runNotificationRulesOnce(logger);
  }, 10_000);
  setInterval(() => {
    runNotificationRulesOnce(logger);
  }, 60 * 60 * 1000);
}
