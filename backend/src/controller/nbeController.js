import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { requestApproval, getApprovalStatus } from "../clients/nbeClient.js";
import { hmacValid } from "../utils/webhookVerify.js";

export const requestFxApproval = async (req, res) => {
  try {
    const { declaration_id, currency = "USD", amount_usd } = req.body || {};
    if (!declaration_id) return res.status(400).json({ message: "declaration_id required" });
    const r = await requestApproval({ declaration_id, currency, amount_usd });
    const ins = await pool.query(
      `INSERT INTO currency_approvals (declaration_id, request_ref, currency, amount_usd, status, raw)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (request_ref) DO UPDATE SET status=EXCLUDED.status, updated_at=now(), raw=EXCLUDED.raw
       RETURNING *`,
      [declaration_id, r.request_ref || null, currency, amount_usd || null, r.status || "Pending", JSON.stringify(r)]
    );
    res.json(ins.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getFxStatus = async (req, res) => {
  try {
    const { declarationId } = req.params;
    const q = await pool.query(`SELECT * FROM currency_approvals WHERE declaration_id=$1 ORDER BY updated_at DESC LIMIT 1`, [declarationId]);
    const row = q.rows[0] || null;
    if (!row) return res.json(null);
    // Optionally poll remote if still pending
    if (row.status === 'Pending' && env.singleWindow?.nbe?.enabled) {
      const s = await getApprovalStatus({ request_ref: row.request_ref });
      await pool.query(`UPDATE currency_approvals SET status=$1, raw=$2, updated_at=now() WHERE approval_id=$3`, [s.status || row.status, JSON.stringify(s), row.approval_id]);
      const fresh = await pool.query(`SELECT * FROM currency_approvals WHERE approval_id=$1`, [row.approval_id]);
      return res.json(fresh.rows[0]);
    }
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const nbeWebhook = async (req, res) => {
  try {
    const secret = env.singleWindow?.nbe?.webhookSecret || "";
    if (secret && !hmacValid(req, secret)) return res.status(401).json({ message: "invalid signature" });
    const { request_ref, status, approved_at, rejected_reason } = req.body || {};
    if (!request_ref) return res.status(400).json({ message: "request_ref required" });
    const up = await pool.query(
      `UPDATE currency_approvals SET status=$1, approved_at=$2, rejected_reason=$3, raw=$4, updated_at=now() WHERE request_ref=$5 RETURNING *`,
      [status || null, approved_at || null, rejected_reason || null, JSON.stringify(req.body || {}), request_ref]
    );
    if (up.rowCount === 0) {
      await pool.query(
        `INSERT INTO currency_approvals (declaration_id, request_ref, status, raw) VALUES (NULL, $1, $2, $3)`,
        [request_ref, status || null, JSON.stringify(req.body || {})]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

