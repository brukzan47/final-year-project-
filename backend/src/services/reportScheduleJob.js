import { pool } from "../config/db.js";
import { sendMail } from "../utils/mailer.js";
import { ReportSchedule } from "../models/ReportSchedule.js";

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function shouldSendNow(row, now = new Date()) {
  if (!row?.enabled) return false;
  const hhmm = String(row.send_time || "");
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm !== cur) return false;
  if (String(row.frequency) === "weekly" && now.getDay() !== 1) return false; // Monday
  const last = row.last_sent_at ? new Date(row.last_sent_at) : null;
  if (!last) return true;
  return fmtDate(last) !== fmtDate(now);
}

async function buildSummaryText() {
  const [u, i, s, d, p] = await Promise.all([
    pool.query("SELECT COUNT(1)::int AS c FROM users"),
    pool.query("SELECT COUNT(1)::int AS c FROM importers"),
    pool.query("SELECT COUNT(1)::int AS c FROM shipments"),
    pool.query("SELECT COUNT(1)::int AS c FROM declarations"),
    pool.query("SELECT COUNT(1)::int AS c FROM payments"),
  ]);
  const counts = {
    users: u.rows?.[0]?.c || 0,
    importers: i.rows?.[0]?.c || 0,
    shipments: s.rows?.[0]?.c || 0,
    declarations: d.rows?.[0]?.c || 0,
    payments: p.rows?.[0]?.c || 0,
  };
  return `Data Analysis Summary\nUsers: ${counts.users}\nImporters: ${counts.importers}\nShipments: ${counts.shipments}\nDeclarations: ${counts.declarations}\nPayments: ${counts.payments}`;
}

export function startReportScheduleJob(logger = console) {
  const run = async () => {
    try {
      const rows = await ReportSchedule.list();
      const now = new Date();
      for (const row of rows) {
        if (!shouldSendNow(row, now)) continue;
        const text = await buildSummaryText();
        const result = await sendMail({
          to: row.recipient_email,
          subject: `Ethiopian Import Customs Report (${fmtDate(now)})`,
          text,
        });
        if (result?.ok || result?.skipped) {
          await ReportSchedule.markSent(row.schedule_id);
        }
      }
    } catch (e) {
      logger?.error?.(`Report schedule job failed: ${e.message}`);
    }
  };
  run();
  setInterval(run, 60 * 1000);
}

