import { pool } from "../../config/db.js";
import { RiskEngineService } from "./risk.service.js";

export const RiskEngineController = {
  async score(req, res) {
    try {
      const declarationId = req.body?.declaration_id;
      if (!declarationId) return res.status(400).json({ message: "declaration_id is required" });

      const scored = await RiskEngineService.scoreAndPersist(declarationId);
      if (!scored) return res.status(404).json({ message: "Declaration not found" });

      return res.json(scored);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  async explain(req, res) {
    try {
      const declarationId = req.params?.declaration_id;
      if (!declarationId) return res.status(400).json({ message: "declaration_id is required" });

      const q = await pool.query(
        `SELECT declaration_id, risk_score, channel AS risk_channel, reasons, model_version, decided_at
         FROM risk_scores
         WHERE declaration_id = $1
         ORDER BY decided_at DESC
         LIMIT 1`,
        [declarationId]
      );

      if (q.rowCount === 0) {
        const latest = await RiskEngineService.scoreAndPersist(declarationId);
        if (!latest) return res.status(404).json({ message: "Declaration not found" });
        return res.json(latest);
      }

      return res.json(q.rows[0]);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  async queues(req, res) {
    try {
      const out = await RiskEngineService.listQueues(req.query?.limit);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  async listDeclarations(req, res) {
    try {
      const channel = String(req.query?.channel || "").trim();
      const minScore = Number(req.query?.min_score || 0);
      const limit = Math.max(1, Math.min(Number(req.query?.limit || 100), 500));
      const params = [Math.max(0, minScore)];
      let where = "WHERE COALESCE(d.risk_score,0) >= $1";

      if (channel) {
        params.push(channel);
        where += ` AND d.risk_channel = $${params.length}`;
      }

      const q = await pool.query(
        `SELECT d.declaration_id, d.declaration_no, d.declaration_date,
                COALESCE(d.risk_score, 0) AS risk_score,
                COALESCE(d.risk_channel, 'Green') AS risk_channel,
                d.risk_reason,
                s.hs_code, s.origin_country, s.cif_value_usd,
                i.company_name
         FROM declarations d
         JOIN shipments s ON s.shipment_id = d.shipment_id
         JOIN importers i ON i.importer_id = s.importer_id
         ${where}
         ORDER BY COALESCE(d.risk_score,0) DESC, d.declaration_date DESC
         LIMIT ${limit}`,
        params
      );

      return res.json({ total: q.rows.length, items: q.rows });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  async backfill(req, res) {
    try {
      const limit = Math.max(1, Math.min(Number(req.body?.limit || 5000), 20000));
      const q = await pool.query(
        `SELECT declaration_id
         FROM declarations
         WHERE risk_channel IS NULL
            OR risk_channel = ''
            OR risk_score IS NULL
            OR risk_score = 0
         ORDER BY declaration_date ASC
         LIMIT $1`,
        [limit]
      );

      let scored = 0;
      let failed = 0;
      for (const row of q.rows) {
        try {
          const out = await RiskEngineService.scoreAndPersist(row.declaration_id);
          if (out) scored += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }

      const dist = await pool.query(
        `SELECT COALESCE(NULLIF(risk_channel,''), 'UNKNOWN') AS channel, COUNT(*)::int AS count
         FROM declarations
         GROUP BY 1
         ORDER BY 2 DESC`
      );

      return res.json({
        processed: q.rows.length,
        scored,
        failed,
        distribution: dist.rows,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
};
