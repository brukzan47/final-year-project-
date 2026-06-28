import { Inspection } from "../models/Inspection.js";
import { pool } from "../config/db.js";
import { notifyImporterByDeclaration } from "../services/notificationService.js";
import { RiskEngineService } from "../modules/risk/risk.service.js";

function norm(value) {
  return String(value || "").trim();
}

function normLower(value) {
  return norm(value).toLowerCase();
}

function titleCase(v) {
  const low = normLower(v);
  if (!low) return "";
  return low.charAt(0).toUpperCase() + low.slice(1);
}

export const getInspections = async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT i.*, d.declaration_no, d.risk_score, d.risk_channel AS assigned_risk_channel, d.risk_reason,
             s.cif_value_usd, s.goods_type, s.origin_country, s.importer_id
      FROM inspections i
      JOIN declarations d ON i.declaration_id = d.declaration_id
      JOIN shipments s ON d.shipment_id = s.shipment_id
      ORDER BY i.inspection_date DESC;
    `);
    const result = rows.rows.map((r) => ({
      ...r,
      risk_score: Number(r.risk_score || 0),
      risk_reasons: r.risk_reason ? String(r.risk_reason).split(";").map((x) => x.trim()).filter(Boolean) : [],
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createInspection = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.release_reference) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      payload.release_reference = `REL-${y}${m}${day}-${rand}`;
    }

    const decQ = await pool.query(
      `SELECT declaration_id, risk_score, risk_channel, risk_reason
       FROM declarations
       WHERE declaration_id = $1
       LIMIT 1`,
      [payload.declaration_id]
    );
    if (decQ.rowCount === 0) return res.status(404).json({ message: "Declaration not found" });

    let dec = decQ.rows[0];
    if (!dec.risk_channel) {
      const rescored = await RiskEngineService.scoreAndPersist(payload.declaration_id);
      if (rescored) {
        dec = {
          ...dec,
          risk_score: rescored.risk_score,
          risk_channel: rescored.risk_channel,
          risk_reason: rescored.risk_reason,
        };
      }
    }

    const assigned = titleCase(dec.risk_channel || "Green");
    const requested = titleCase(payload.risk_channel || assigned);
    const actorRole = titleCase(req.user?.role || "");

    const priority = { Green: 1, Yellow: 2, Red: 3 };
    const isDowngrade = (priority[requested] || 0) < (priority[assigned] || 0);

    if (normLower(assigned) === "red" && normLower(requested) !== "red") {
      if (actorRole !== "Admin") {
        return res.status(403).json({
          message: "Only Admin (supervisor) can approve downgrade of assigned Red channel.",
        });
      }
      if (!payload.supervisor_approved || !norm(payload.supervisor_reason)) {
        return res.status(403).json({
          message: "Assigned Red risk cannot be downgraded without supervisor approval and reason logging.",
        });
      }
    }

    if (isDowngrade && !norm(payload.override_reason)) {
      return res.status(400).json({ message: "override_reason is required when lowering the assigned channel." });
    }

    payload.risk_channel = requested;
    payload.supervisor_approved = !!payload.supervisor_approved;
    payload.supervisor_reason = payload.supervisor_reason || null;
    payload.override_reason = payload.override_reason || null;

    const inspection = await Inspection.create(payload);
    try {
      await notifyImporterByDeclaration({
        declarationId: payload.declaration_id,
        title: { en: "Inspection Completed", am: "ምርመራ ተጠናቋል" },
        message: {
          en: `Inspection result: ${payload.inspection_result || "Pending"}. Reference: ${inspection.release_reference || "N/A"}`,
          am: `የምርመራ ውጤት: ${payload.inspection_result || "Pending"}. ማጣቀሻ: ${inspection.release_reference || "N/A"}`,
        },
        category: "INSPECTION",
        type: payload.inspection_result === "Passed" ? "SUCCESS" : "WARNING",
        referenceId: payload.declaration_id,
        eventKey: `event:inspection_completed:${inspection.inspection_id}`,
      });
    } catch {}
    res.status(201).json({
      ...inspection,
      assigned_risk_channel: assigned,
      assigned_risk_score: Number(dec.risk_score || 0),
      assigned_risk_reason: dec.risk_reason || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
