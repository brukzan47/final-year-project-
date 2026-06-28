import { ReportSchedule } from "../models/ReportSchedule.js";

function validTime(v) {
  return /^\d{2}:\d{2}$/.test(String(v || ""));
}

export const listReportSchedules = async (_req, res) => {
  try {
    const rows = await ReportSchedule.list();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const saveReportSchedule = async (req, res) => {
  try {
    const { schedule_id = null, recipient_email, frequency = "daily", send_time = "08:00", enabled = true } = req.body || {};
    if (!recipient_email || !/.+@.+\..+/.test(String(recipient_email))) {
      return res.status(400).json({ message: "Valid recipient_email is required" });
    }
    if (!["daily", "weekly"].includes(String(frequency))) {
      return res.status(400).json({ message: "frequency must be daily or weekly" });
    }
    if (!validTime(send_time)) {
      return res.status(400).json({ message: "send_time must be HH:mm" });
    }
    const row = await ReportSchedule.upsert({
      schedule_id,
      created_by: req.user?.id || null,
      recipient_email: String(recipient_email).trim().toLowerCase(),
      frequency: String(frequency),
      send_time: String(send_time),
      enabled: !!enabled,
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteReportSchedule = async (req, res) => {
  try {
    const count = await ReportSchedule.remove(req.params.id);
    if (!count) return res.status(404).json({ message: "Schedule not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

