import { pool } from "../config/db.js";
import { RiskService } from "../services/riskService.js";
import { logger } from "../utils/logger.js";

async function loadContextByDeclarationId(declarationId) {
  const q = await pool.query(
    `SELECT d.declaration_id, d.declaration_no, d.declaration_date, d.created_at AS declaration_created_at,
            s.*, perf.number_of_queries, perf.penalties, perf.feedback_score
     FROM declarations d
     JOIN shipments s ON d.shipment_id = s.shipment_id
     LEFT JOIN performance perf ON perf.importer_id = s.importer_id
     WHERE d.declaration_id=$1
     LIMIT 1`,
    [declarationId]
  );
  const row = q.rows[0];
  if (!row) return null;
  const shipment = {
    shipment_id: row.shipment_id,
    importer_id: row.importer_id,
    shipment_reference: row.shipment_reference,
    tracking_ref: row.tracking_ref,
    description_of_goods: row.description_of_goods,
    goods_type: row.goods_type,
    hs_code: row.hs_code,
    quantity: row.quantity,
    unit_of_measure: row.unit_of_measure,
    cif_value_usd: row.cif_value_usd,
    origin_country: row.origin_country,
    destination_port: row.destination_port,
    mode_of_transport: row.mode_of_transport,
    arrival_date: row.arrival_date,
  };
  const performance = {
    number_of_queries: row.number_of_queries,
    penalties: row.penalties,
    feedback_score: row.feedback_score,
  };
  // Load goods items: prefer by declaration; if none, fallback to items attached to shipment
  let itemsQ = await pool.query(
    `SELECT goods_item_id, hs_code, description, quantity, unit_of_measure, value_usd, origin_country, created_at
     FROM goods_items WHERE declaration_id=$1 ORDER BY created_at DESC`,
    [declarationId]
  );
  let goods_items = itemsQ.rows;
  if (!goods_items || goods_items.length === 0) {
    try {
      const q2 = await pool.query(`SELECT shipment_id FROM declarations WHERE declaration_id=$1`, [declarationId]);
      const sid = q2.rows[0]?.shipment_id;
      if (sid) {
        const itemsQ2 = await pool.query(
          `SELECT goods_item_id, hs_code, description, quantity, unit_of_measure, value_usd, origin_country, created_at
           FROM goods_items WHERE shipment_id=$1 ORDER BY created_at DESC`,
          [sid]
        );
        goods_items = itemsQ2.rows;
      }
    } catch {}
  }
  return { shipment, performance, goods_items };
}

export const RiskController = {
  async score(req, res) {
    try {
      const { declaration_id: idFromBody } = req.body || {};
      let payload = req.body || {};

      if (idFromBody && (!payload.shipment || !payload.shipment.hs_code)) {
        const ctx = await loadContextByDeclarationId(idFromBody);
        if (!ctx) return res.status(404).json({ error: "Declaration not found" });
        payload = { ...payload, ...ctx };
      }

      const result = await RiskService.score(payload);

      try {
        const declarationId = idFromBody || payload.declaration_id || null;
        if (declarationId) {
          const reasonsJson = JSON.stringify(result.reasons || []);
          const featuresJson = JSON.stringify(payload || {});
          const scoreInt = Number.parseInt(result.risk_score || 0, 10);
          const channel = String(result.channel || "");
          const modelVersion = String(result.model_version || result.modelVersion || "unknown");
          await pool.query(
            `INSERT INTO risk_scores (declaration_id, risk_score, channel, reasons, model_version, features)
             VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb)`,
            [declarationId, scoreInt, channel, reasonsJson, modelVersion, featuresJson]
          );

          // Persist item-level scores using heuristic from risk_item_features view
          try {
            const items = await pool.query(
              `SELECT rif.goods_item_id, rif.declaration_id, rif.undervaluation_flag, rif.overvaluation_flag,
                      rif.origin_watchlist_flag, rif.hs_prior_risk, rif.route_prior_risk,
                      rif.value_ratio_vs_hs_p50
               FROM risk_item_features rif
               WHERE rif.declaration_id = $1`,
              [declarationId]
            );
            let rows = items.rows || [];
            if (rows.length === 0) {
              const x = await pool.query(
                `SELECT gi.goods_item_id,
                        CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN 0
                             WHEN (gi.value_usd / NULLIF(gi.quantity,0)) < 0.7 * rp.p50_value_usd THEN 1 ELSE 0 END AS undervaluation_flag,
                        CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN 0
                             WHEN (gi.value_usd / NULLIF(gi.quantity,0)) > 2.0 * rp.p50_value_usd THEN 1 ELSE 0 END AS overvaluation_flag,
                        CASE WHEN LOWER(COALESCE(NULLIF(gi.origin_country,''), s.origin_country)) IN ('somalia','yemen','afghanistan','syria','libya') THEN 1 ELSE 0 END AS origin_watchlist_flag,
                        COALESCE(hp.bad_rate, 0.0) AS hs_prior_risk,
                        COALESCE(rp2.bad_rate, 0.0) AS route_prior_risk,
                        CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN NULL
                             ELSE (gi.value_usd / NULLIF(gi.quantity,0)) / NULLIF(rp.p50_value_usd,0) END AS value_ratio_vs_hs_p50
                 FROM declarations d
                 JOIN shipments s ON s.shipment_id = d.shipment_id
                 JOIN goods_items gi ON gi.shipment_id = s.shipment_id
                 LEFT JOIN reference_prices rp ON rp.hs_code = gi.hs_code AND rp.origin_country = COALESCE(NULLIF(gi.origin_country,''), s.origin_country, '') AND rp.unit_of_measure = COALESCE(gi.unit_of_measure,'')
                 LEFT JOIN risk_hs_priors hp ON hp.hs_code = gi.hs_code
                 LEFT JOIN risk_route_priors rp2 ON rp2.origin_country = COALESCE(NULLIF(gi.origin_country,''), s.origin_country) AND rp2.destination_port = s.destination_port AND rp2.mode_of_transport = s.mode_of_transport
                 WHERE d.declaration_id = $1`,
                [declarationId]
              );
              rows = x.rows || [];
            }
            for (const r of rows) {
              const uv = Number(r.undervaluation_flag || 0);
              const ov = Number(r.overvaluation_flag || 0);
              const ow = Number(r.origin_watchlist_flag || 0);
              const hs = Number(r.hs_prior_risk || 0);
              const route = Number(r.route_prior_risk || 0);
              const score = Math.max(
                0,
                Math.min(
                  (uv ? 40 : 0) + (ov ? 15 : 0) + (ow ? 20 : 0) + Math.round(100 * (hs * 0.5 + route * 0.3)),
                  100
                )
              );
              const channelItem = score < 41 ? "green" : score <= 70 ? "yellow" : "red";
              const reasons = [];
              if (uv) reasons.push({ feature: "undervaluation_flag", detail: `value_ratio_vs_hs_p50=${r.value_ratio_vs_hs_p50}` });
              if (ov) reasons.push({ feature: "overvaluation_flag" });
              if (ow) reasons.push({ feature: "origin_watchlist_flag" });
              if (hs) reasons.push({ feature: "hs_prior_risk", value: hs });
              if (route) reasons.push({ feature: "route_prior_risk", value: route });
              await pool.query(
                `INSERT INTO risk_item_scores (goods_item_id, declaration_id, risk_score, channel, reasons, model_version)
                 VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
                [r.goods_item_id, declarationId, score, channelItem, JSON.stringify(reasons), modelVersion]
              );
            }
          } catch (e) {
            // best-effort; don't block response
            logger.warn(`Item risk persistence skipped: ${e.message}`);
          }
        }
      } catch (e) {
        logger.error(`Failed to persist risk score: ${e.message}`);
      }

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async feedback(req, res) {
    try {
      const { declaration_id, officer_label, notes } = req.body || {};
      if (!declaration_id || !officer_label) {
        return res.status(400).json({ error: "declaration_id and officer_label are required" });
      }
      const result = await RiskService.feedback({ declaration_id, officer_label, notes });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async explain(req, res) {
    try {
      const { declaration_id } = req.params || {};
      if (!declaration_id) return res.status(400).json({ error: "declaration_id param is required" });

      const q = await pool.query(
        `SELECT declaration_id, risk_score, channel, reasons, model_version, decided_at, features
         FROM risk_scores
         WHERE declaration_id = $1
         ORDER BY decided_at DESC
         LIMIT 1`,
        [declaration_id]
      );
      const row = q.rows[0];
      if (!row) return res.status(404).json({ error: "No risk score found for declaration" });
      return res.json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async listDeclarations(req, res) {
    try {
      const {
        since,
        min_score,
        channel,
        hs_code,
        importer_id,
        destination_port,
        limit,
      } = req.query || {};

      const sinceTs = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const minScore = Number.isFinite(Number(min_score)) ? Number(min_score) : 0;
      const lim = Number.isFinite(Number(limit)) ? Math.min(Number(limit), 500) : 100;

      const whereClauses = ["l.rn = 1", "l.decided_at >= $1", "l.risk_score >= $2"];
      const params = [sinceTs, minScore];

      if (channel) {
        whereClauses.push("l.channel = $" + (params.length + 1));
        params.push(String(channel));
      }
      if (hs_code) {
        whereClauses.push("s.hs_code = $" + (params.length + 1));
        params.push(String(hs_code));
      }
      if (importer_id) {
        whereClauses.push("s.importer_id = $" + (params.length + 1));
        params.push(String(importer_id));
      }
      if (destination_port) {
        whereClauses.push("s.destination_port = $" + (params.length + 1));
        params.push(String(destination_port));
      }

      const sql = `
        WITH latest AS (
          SELECT rs.*, ROW_NUMBER() OVER (PARTITION BY rs.declaration_id ORDER BY rs.decided_at DESC) AS rn
          FROM risk_scores rs
          WHERE rs.decided_at >= $1
        )
        SELECT l.declaration_id, d.declaration_no, d.declaration_date,
               l.risk_score, l.channel, l.decided_at,
               s.hs_code, s.goods_type, s.origin_country, s.destination_port, s.mode_of_transport,
               i.company_name
        FROM latest l
        JOIN declarations d ON d.declaration_id = l.declaration_id
        JOIN shipments s ON s.shipment_id = d.shipment_id
        JOIN importers i ON i.importer_id = s.importer_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY l.risk_score DESC, l.decided_at DESC
        LIMIT ${lim}
      `;

      const q = await pool.query(sql, params);
      return res.json({ total: q.rows.length, items: q.rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async itemsByDeclaration(req, res) {
    try {
      const { declaration_id } = req.params || {};
      if (!declaration_id) return res.status(400).json({ error: "declaration_id param is required" });

      // Prefer the view if present; otherwise fallback to base goods_items
      let q;
      try {
        q = await pool.query(
          `SELECT gi.goods_item_id, gi.declaration_id, gi.hs_code, gi.description, gi.quantity, gi.unit_of_measure,
                  gi.value_usd, gi.origin_country,
                  rif.value_per_unit_usd, rif.value_ratio_vs_hs_p50,
                  rif.undervaluation_flag, rif.overvaluation_flag, rif.origin_watchlist_flag,
                  rif.hs_prior_risk, rif.route_prior_risk
           FROM goods_items gi
           LEFT JOIN risk_item_features rif ON rif.goods_item_id = gi.goods_item_id
           WHERE gi.declaration_id = $1
           ORDER BY gi.created_at DESC`,
          [declaration_id]
        );
        if (q.rowCount === 0) {
          const sidQ = await pool.query(`SELECT shipment_id FROM declarations WHERE declaration_id=$1`, [declaration_id]);
          const sid = sidQ.rows[0]?.shipment_id;
          if (sid) {
            q = await pool.query(
              `SELECT goods_item_id, NULL as declaration_id, hs_code, description, quantity, unit_of_measure, value_usd, origin_country
               FROM goods_items WHERE shipment_id=$1 ORDER BY created_at DESC`,
              [sid]
            );
          }
        }
      } catch (e) {
        q = await pool.query(
          `SELECT goods_item_id, declaration_id, hs_code, description, quantity, unit_of_measure, value_usd, origin_country
           FROM goods_items WHERE declaration_id=$1 ORDER BY created_at DESC`,
          [declaration_id]
        );
      }

      // Add a lightweight heuristic score for UI sorting if feature columns exist
      const items = (q.rows || []).map((r) => {
        const uv = Number(r.undervaluation_flag || 0);
        const ov = Number(r.overvaluation_flag || 0);
        const ow = Number(r.origin_watchlist_flag || 0);
        const hs = Number(r.hs_prior_risk || 0);
        const route = Number(r.route_prior_risk || 0);
        const base = (uv ? 40 : 0) + (ov ? 15 : 0) + (ow ? 20 : 0) + Math.round(100 * (hs * 0.5 + route * 0.3));
        const risk_score = Math.max(0, Math.min(base, 100));
        return { ...r, risk_score };
      });

      return res.json({ total: items.length, items });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async listRiskyItems(req, res) {
    try {
      const { since, min_score, hs_code, destination_port, limit } = req.query || {};
      const sinceTs = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const lim = Number.isFinite(Number(limit)) ? Math.min(Number(limit), 500) : 100;
      const minScore = Number.isFinite(Number(min_score)) ? Number(min_score) : 0;

      const filters = ["d.declaration_date >= $1"]; const params = [sinceTs];
      if (hs_code) { filters.push("gi.hs_code = $" + (params.length + 1)); params.push(String(hs_code)); }
      if (destination_port) { filters.push("s.destination_port = $" + (params.length + 1)); params.push(String(destination_port)); }

      const sql = `
        SELECT gi.goods_item_id, gi.declaration_id, gi.hs_code, gi.description, gi.quantity, gi.unit_of_measure,
               gi.value_usd, COALESCE(NULLIF(gi.origin_country,''), s.origin_country) AS origin_country,
               s.destination_port, s.mode_of_transport, d.declaration_no, d.declaration_date,
               rif.value_ratio_vs_hs_p50, rif.undervaluation_flag, rif.overvaluation_flag,
               rif.origin_watchlist_flag, rif.hs_prior_risk, rif.route_prior_risk,
               -- Heuristic risk score for listing
               ((CASE WHEN rif.undervaluation_flag=1 THEN 40 ELSE 0 END)
                + (CASE WHEN rif.overvaluation_flag=1 THEN 15 ELSE 0 END)
                + (COALESCE(rif.origin_watchlist_flag,0) * 20)
                + ROUND(100 * (COALESCE(rif.hs_prior_risk,0)*0.5 + COALESCE(rif.route_prior_risk,0)*0.3))
               ) AS risk_score
        FROM goods_items gi
        JOIN declarations d ON d.declaration_id = gi.declaration_id
        JOIN shipments s ON s.shipment_id = d.shipment_id
        LEFT JOIN risk_item_features rif ON rif.goods_item_id = gi.goods_item_id
        WHERE ${filters.join(" AND ")}
          AND ((CASE WHEN rif.undervaluation_flag=1 THEN 40 ELSE 0 END)
                + (CASE WHEN rif.overvaluation_flag=1 THEN 15 ELSE 0 END)
                + (COALESCE(rif.origin_watchlist_flag,0) * 20)
                + ROUND(100 * (COALESCE(rif.hs_prior_risk,0)*0.5 + COALESCE(rif.route_prior_risk,0)*0.3))
               ) >= $${params.length + 1}
        ORDER BY risk_score DESC, d.declaration_date DESC
        LIMIT ${lim}
      `;

      params.push(minScore);
      const q = await pool.query(sql, params);
      return res.json({ total: q.rows.length, items: q.rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Admin: backfill shipment-linked goods_items to declarations and enforce XOR link
  async backfillGoodsItems(req, res) {
    try {
      const a = await pool.query(
        `UPDATE goods_items gi
           SET declaration_id = d.declaration_id
         FROM declarations d
         JOIN shipments s ON s.shipment_id = d.shipment_id
         WHERE gi.shipment_id = s.shipment_id AND gi.declaration_id IS NULL`
      );
      const b = await pool.query(
        `UPDATE goods_items SET shipment_id = NULL WHERE declaration_id IS NOT NULL AND shipment_id IS NOT NULL`
      );
      return res.json({ linked: a.rowCount || 0, cleared_shipment_link: b.rowCount || 0 });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
