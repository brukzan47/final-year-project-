import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { requestPermit, getPermitStatus } from "../clients/tradeClient.js";
import { hmacValid } from "../utils/webhookVerify.js";

export const requestTradePermit = async (req, res) => {
  try {
    const { declaration_id, goods = [], value_usd, hs_codes = [] } = req.body || {};
    if (!declaration_id) return res.status(400).json({ message: "declaration_id required" });
    const r = await requestPermit({ declaration_id, goods });
    const ins = await pool.query(
      `INSERT INTO import_permits (declaration_id, permit_no, hs_code, value_usd, status, raw)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (permit_no) DO UPDATE SET status=EXCLUDED.status, updated_at=now(), raw=EXCLUDED.raw
       RETURNING *`,
      [declaration_id, r.permit_no || null, hs_codes, value_usd || null, r.status || 'Pending', JSON.stringify(r)]
    );
    res.json(ins.rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getTradePermit = async (req, res) => {
  try {
    const { declarationId } = req.params;
    const q = await pool.query(`SELECT * FROM import_permits WHERE declaration_id=$1 ORDER BY updated_at DESC LIMIT 1`, [declarationId]);
    const row = q.rows[0] || null;
    if (!row) return res.json(null);
    if (row.status === 'Pending' && env.singleWindow?.trade?.enabled && row.permit_no) {
      const s = await getPermitStatus({ permit_no: row.permit_no });
      await pool.query(`UPDATE import_permits SET status=$1, raw=$2, updated_at=now() WHERE permit_id=$3`, [s.status || row.status, JSON.stringify(s), row.permit_id]);
      const fresh = await pool.query(`SELECT * FROM import_permits WHERE permit_id=$1`, [row.permit_id]);
      return res.json(fresh.rows[0]);
    }
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const tradeWebhook = async (req, res) => {
  try {
    const secret = env.singleWindow?.trade?.webhookSecret || "";
    if (secret && !hmacValid(req, secret)) return res.status(401).json({ message: "invalid signature" });
    const { permit_no, status, issued_at, expires_at } = req.body || {};
    if (!permit_no) return res.status(400).json({ message: "permit_no required" });
    const up = await pool.query(
      `UPDATE import_permits SET status=$1, issued_at=$2, expires_at=$3, raw=$4, updated_at=now() WHERE permit_no=$5 RETURNING *`,
      [status || null, issued_at || null, expires_at || null, JSON.stringify(req.body || {}), permit_no]
    );
    if (up.rowCount === 0) {
      await pool.query(
        `INSERT INTO import_permits (declaration_id, permit_no, status, raw) VALUES (NULL, $1, $2, $3)`,
        [permit_no, status || null, JSON.stringify(req.body || {})]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

