import { pool } from "../config/db.js";

function parseDateRange(query) {
  const start = query.start ? new Date(query.start) : null;
  const end = query.end ? new Date(query.end) : null;
  return { start: isNaN(start) ? null : start, end: isNaN(end) ? null : end };
}

export const AnalyticsController = {
  async revenueTrends(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT to_char(date_trunc('month', COALESCE(p.approved_at, p.payment_date, d.declaration_date)), 'YYYY-MM') AS period,
                 COALESCE(SUM(p.duty_paid),0) AS duty,
                 COALESCE(SUM(p.vat_paid),0) AS vat,
                 COALESCE(SUM(p.excise_paid),0) AS excise,
                 0::numeric AS surtax,
                 COALESCE(SUM(COALESCE(p.duty_paid,0)+COALESCE(p.vat_paid,0)+COALESCE(p.excise_paid,0)),0) AS total
          FROM declarations d
          LEFT JOIN payments p ON p.declaration_id = d.declaration_id AND p.payment_status = 'Paid'
          WHERE ($1::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) >= $1::date)
            AND ($2::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) <= $2::date)
          GROUP BY 1
          ORDER BY 1 ASC
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async riskChannels(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          WITH channels AS (
            SELECT 'Green'::text AS channel
            UNION ALL SELECT 'Yellow'::text
            UNION ALL SELECT 'Red'::text
          ),
          base AS (
            SELECT
              CASE
                WHEN LOWER(COALESCE(NULLIF(d.risk_channel,''), NULLIF(i.risk_channel,''), '')) = 'green' THEN 'Green'
                WHEN LOWER(COALESCE(NULLIF(d.risk_channel,''), NULLIF(i.risk_channel,''), '')) = 'yellow' THEN 'Yellow'
                WHEN LOWER(COALESCE(NULLIF(d.risk_channel,''), NULLIF(i.risk_channel,''), '')) = 'red' THEN 'Red'
                ELSE 'UNKNOWN'
              END AS channel,
              COUNT(*)::int AS cnt
            FROM declarations d
            LEFT JOIN inspections i ON i.declaration_id = d.declaration_id
            WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
              AND ($2::date IS NULL OR d.declaration_date <= $2::date)
            GROUP BY 1
          )
          SELECT c.channel,
                 COALESCE(b.cnt, 0)::int AS count,
                 ROUND(
                   (
                     100.0 * COALESCE(b.cnt, 0) / NULLIF(
                       (SELECT SUM(COALESCE(b2.cnt,0)) FROM channels c2 LEFT JOIN base b2 ON b2.channel = c2.channel),
                       0
                     )
                   )::numeric,
                   2
                 ) AS percent
          FROM channels c
          LEFT JOIN base b ON b.channel = c.channel
          ORDER BY CASE c.channel WHEN 'Green' THEN 1 WHEN 'Yellow' THEN 2 ELSE 3 END
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async pendingVsCleared(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const row = (
        await pool.query(
          `
          WITH base AS (
            SELECT d.declaration_id, d.status,
                   EXISTS (SELECT 1 FROM payments p WHERE p.declaration_id=d.declaration_id AND p.payment_status='Paid') AS paid,
                   EXISTS (SELECT 1 FROM inspections i WHERE i.declaration_id=d.declaration_id) AS inspected,
                   EXISTS (SELECT 1 FROM clearances c WHERE c.declaration_id=d.declaration_id AND c.release_date IS NOT NULL) AS cleared
            FROM declarations d
            WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
              AND ($2::date IS NULL OR d.declaration_date <= $2::date)
          )
          SELECT
            SUM(CASE WHEN NOT paid AND status <> 'Rejected' THEN 1 ELSE 0 END)::int AS pending_payment,
            SUM(CASE WHEN paid AND NOT inspected AND status <> 'Rejected' THEN 1 ELSE 0 END)::int AS awaiting_inspection,
            SUM(CASE WHEN inspected AND NOT cleared AND status <> 'Rejected' THEN 1 ELSE 0 END)::int AS under_inspection,
            SUM(CASE WHEN cleared THEN 1 ELSE 0 END)::int AS cleared,
            SUM(CASE WHEN status='Rejected' THEN 1 ELSE 0 END)::int AS rejected
          FROM base
          `,
          [start, end]
        )
      ).rows?.[0] || { pending_payment: 0, awaiting_inspection: 0, under_inspection: 0, cleared: 0, rejected: 0 };
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async clearanceAvg(req, res) {
    try {
      const by = (req.query?.by || "port").toString().toLowerCase();
      const { start, end } = parseDateRange(req.query || {});
      const groupKey = by === "channel" ? "COALESCE(d.risk_channel,'UNKNOWN')" : "COALESCE(d.customs_station,'N/A')";
      const rows = (
        await pool.query(
          `
          SELECT ${groupKey} AS key,
                 ROUND((AVG(EXTRACT(EPOCH FROM (c.release_date::timestamp - d.declaration_date::timestamp)))/86400.0)::numeric, 2) AS avg_days
          FROM declarations d
          JOIN clearances c ON c.declaration_id = d.declaration_id AND c.release_date IS NOT NULL
          WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
            AND ($2::date IS NULL OR d.declaration_date <= $2::date)
          GROUP BY ${groupKey}
          ORDER BY avg_days ASC
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async goodsSummary(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT s.hs_code,
                 COALESCE(SUM(s.cif_value_usd),0) AS total_cif,
                 COUNT(DISTINCT d.declaration_id)::int AS declarations
          FROM shipments s
          JOIN declarations d ON d.shipment_id = s.shipment_id
          WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
            AND ($2::date IS NULL OR d.declaration_date <= $2::date)
          GROUP BY s.hs_code
          ORDER BY total_cif DESC
          LIMIT 25
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async sectorVolume(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT COALESCE(i.sector_type,'Unknown') AS sector,
                 COUNT(DISTINCT s.shipment_id)::int AS shipments,
                 COUNT(DISTINCT d.declaration_id)::int AS declarations,
                 COALESCE(SUM(s.cif_value_usd),0) AS total_cif
          FROM shipments s
          JOIN importers i ON i.importer_id = s.importer_id
          LEFT JOIN declarations d ON d.shipment_id = s.shipment_id
          WHERE ($1::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) >= $1::date)
            AND ($2::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) <= $2::date)
          GROUP BY COALESCE(i.sector_type,'Unknown')
          ORDER BY total_cif DESC
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async topCountries(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT COALESCE(s.origin_country,'Unknown') AS country,
                 COUNT(*)::int AS shipments,
                 COALESCE(SUM(s.cif_value_usd),0) AS total_cif
          FROM shipments s
          LEFT JOIN declarations d ON d.shipment_id = s.shipment_id
          WHERE ($1::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) >= $1::date)
            AND ($2::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) <= $2::date)
          GROUP BY COALESCE(s.origin_country,'Unknown')
          ORDER BY total_cif DESC
          LIMIT 20
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async anomaliesLowDeclarations(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          WITH daily AS (
            SELECT d.declaration_date AS day, COUNT(*)::int AS cnt
            FROM declarations d
            WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
              AND ($2::date IS NULL OR d.declaration_date <= $2::date)
            GROUP BY d.declaration_date
          ), stats AS (
            SELECT AVG(cnt) AS avg_cnt, STDDEV_POP(cnt) AS std_cnt FROM daily
          )
          SELECT day, cnt,
                 (SELECT avg_cnt FROM stats) AS avg_cnt,
                 (SELECT std_cnt FROM stats) AS std_cnt,
                 CASE WHEN cnt < (SELECT avg_cnt - 2 * COALESCE(std_cnt,0) FROM stats) THEN TRUE ELSE FALSE END AS is_anomaly
          FROM daily
          ORDER BY day
          `,
          [start, end]
        )
      ).rows;
      res.json({ days: rows });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async forecastRevenueMonthly(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const horizon = Math.max(1, Math.min(parseInt(req.query?.horizon || "3", 10) || 3, 12));
      const hist = (
        await pool.query(
          `
          SELECT to_char(date_trunc('month', COALESCE(p.approved_at, p.payment_date, d.declaration_date)), 'YYYY-MM') AS period,
                 COALESCE(SUM(COALESCE(p.duty_paid,0)+COALESCE(p.vat_paid,0)+COALESCE(p.excise_paid,0)),0) AS total
          FROM declarations d
          LEFT JOIN payments p ON p.declaration_id = d.declaration_id AND p.payment_status = 'Paid'
          WHERE ($1::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) >= $1::date)
            AND ($2::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) <= $2::date)
          GROUP BY 1
          ORDER BY 1 ASC
          `,
          [start, end]
        )
      ).rows;

      if (!hist || hist.length < 2) return res.json({ history: hist || [], forecast: [] });

      const totals = hist.map((r) => Number(r.total) || 0);
      const n = totals.length;
      const xs = Array.from({ length: n }, (_, i) => i);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = totals.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * totals[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = n === 0 ? 0 : (sumY - m * sumX) / n;

      const lastPeriod = hist[n - 1].period;
      const [yStr, mStr] = lastPeriod.split("-");
      let y = parseInt(yStr, 10) || 2024;
      let mo = parseInt(mStr, 10) || 1;
      const forecast = [];
      for (let k = 1; k <= horizon; k++) {
        const idx = n - 1 + k;
        let pred = m * idx + b;
        if (!isFinite(pred)) pred = 0;
        mo += 1;
        if (mo > 12) {
          mo = 1;
          y += 1;
        }
        const period = `${y}-${String(mo).padStart(2, "0")}`;
        forecast.push({ period, pred_total: Math.max(0, Math.round(pred * 100) / 100) });
      }

      res.json({ history: hist, forecast });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async declarationsList(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const country = (req.query?.country || "").toString() || null;
      const sector = (req.query?.sector || "").toString() || null;
      const channel = (req.query?.channel || "").toString() || null;
      const port = (req.query?.port || "").toString() || null;
      const hs = (req.query?.hs || "").toString() || null;

      const whereParts = [
        "($1::date IS NULL OR d.declaration_date >= $1::date)",
        "($2::date IS NULL OR d.declaration_date <= $2::date)",
      ];
      const params = [start, end];

      if (country) whereParts.push("(s.origin_country = $" + params.push(country) + ")");
      if (sector) whereParts.push("(i.sector_type = $" + params.push(sector) + ")");
      if (channel) whereParts.push("(d.risk_channel = $" + params.push(channel) + ")");
      if (port) whereParts.push("(d.customs_station = $" + params.push(port) + ")");
      if (hs) whereParts.push("(s.hs_code = $" + params.push(hs) + ")");

      const where = whereParts.join(" AND ");
      const rows = (
        await pool.query(
          `
          SELECT d.declaration_id, d.declaration_no, d.declaration_date, d.status, d.customs_station,
                 d.risk_score, d.risk_channel,
                 i.company_name, i.sector_type, s.origin_country, s.hs_code, s.cif_value_usd
          FROM declarations d
          JOIN shipments s ON s.shipment_id = d.shipment_id
          JOIN importers i ON i.importer_id = s.importer_id
          WHERE ${where}
          ORDER BY d.declaration_date DESC
          LIMIT 500
          `,
          params
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async highRiskHsCodes(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT s.hs_code,
                 COUNT(*)::int AS declarations,
                 AVG(COALESCE(d.risk_score, 0))::numeric(10,2) AS avg_risk_score,
                 COALESCE(SUM(s.cif_value_usd),0) AS total_cif
          FROM declarations d
          JOIN shipments s ON s.shipment_id = d.shipment_id
          WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
            AND ($2::date IS NULL OR d.declaration_date <= $2::date)
            AND LOWER(COALESCE(d.risk_channel, '')) = 'red'
          GROUP BY s.hs_code
          ORDER BY declarations DESC, avg_risk_score DESC
          LIMIT 15
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async topRiskyImporters(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT i.importer_id, i.company_name,
                 COUNT(*)::int AS declarations,
                 AVG(COALESCE(d.risk_score, 0))::numeric(10,2) AS avg_risk_score,
                 SUM(CASE WHEN LOWER(COALESCE(d.risk_channel,'')) = 'red' THEN 1 ELSE 0 END)::int AS red_count
          FROM declarations d
          JOIN shipments s ON s.shipment_id = d.shipment_id
          JOIN importers i ON i.importer_id = s.importer_id
          WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
            AND ($2::date IS NULL OR d.declaration_date <= $2::date)
          GROUP BY i.importer_id, i.company_name
          ORDER BY avg_risk_score DESC, red_count DESC
          LIMIT 15
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async countryRiskHeatmap(req, res) {
    try {
      const { start, end } = parseDateRange(req.query || {});
      const rows = (
        await pool.query(
          `
          SELECT COALESCE(s.origin_country, 'Unknown') AS country,
                 COUNT(*)::int AS declarations,
                 AVG(COALESCE(d.risk_score, 0))::numeric(10,2) AS avg_risk_score,
                 SUM(CASE WHEN LOWER(COALESCE(d.risk_channel,'')) = 'red' THEN 1 ELSE 0 END)::int AS red_count
          FROM declarations d
          JOIN shipments s ON s.shipment_id = d.shipment_id
          WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
            AND ($2::date IS NULL OR d.declaration_date <= $2::date)
          GROUP BY COALESCE(s.origin_country, 'Unknown')
          ORDER BY avg_risk_score DESC, declarations DESC
          LIMIT 60
          `,
          [start, end]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};
