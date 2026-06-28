import { pool } from "../config/db.js";

export const ExportController = {
  async goodsCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
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
          `,
          [start, end]
        )
      ).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="goods.csv"');
      res.write('hs_code,total_cif,declarations\n');
      for (const r of rows) res.write(`${r.hs_code || ''},${r.total_cif || 0},${r.declarations || 0}\n`);
      res.end();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
  async revenueCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const rows = (await pool.query(`
        SELECT to_char(date_trunc('month', COALESCE(p.approved_at, p.payment_date, d.declaration_date)), 'YYYY-MM') AS period,
               COALESCE(SUM(COALESCE(p.duty_paid,0)+COALESCE(p.vat_paid,0)+COALESCE(p.excise_paid,0)),0) AS total,
               COALESCE(SUM(p.duty_paid),0) AS duty,
               COALESCE(SUM(p.vat_paid),0) AS vat,
               COALESCE(SUM(p.excise_paid),0) AS excise
        FROM declarations d
        LEFT JOIN payments p ON p.declaration_id = d.declaration_id AND p.payment_status='Paid'
        WHERE ($1::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) >= $1::date)
          AND ($2::date IS NULL OR COALESCE(p.approved_at, p.payment_date, d.declaration_date) <= $2::date)
        GROUP BY 1 ORDER BY 1 ASC
      `, [start, end])).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="revenue.csv"');
      res.write('period,total,duty,vat,excise\n');
      for (const r of rows) res.write(`${r.period},${r.total},${r.duty},${r.vat},${r.excise}\n`);
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  async riskCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const rows = (await pool.query(`
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
        SELECT c.channel, COALESCE(b.cnt, 0)::int AS count
        FROM channels c
        LEFT JOIN base b ON b.channel = c.channel
        ORDER BY CASE c.channel WHEN 'Green' THEN 1 WHEN 'Yellow' THEN 2 ELSE 3 END
      `, [start, end])).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="risk_channels.csv"');
      res.write('channel,count\n');
      for (const r of rows) res.write(`${r.channel},${r.count}\n`);
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  async sectorCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const rows = (await pool.query(`
        SELECT COALESCE(i.sector_type,'Unknown') AS sector,
               COUNT(DISTINCT s.shipment_id)::int AS shipments,
               COALESCE(SUM(s.cif_value_usd),0) AS total_cif
        FROM shipments s
        JOIN importers i ON i.importer_id = s.importer_id
        LEFT JOIN declarations d ON d.shipment_id = s.shipment_id
        WHERE ($1::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) >= $1::date)
          AND ($2::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) <= $2::date)
        GROUP BY COALESCE(i.sector_type,'Unknown')
        ORDER BY total_cif DESC
      `, [start, end])).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sector_volume.csv"');
      res.write('sector,shipments,total_cif\n');
      for (const r of rows) res.write(`${r.sector},${r.shipments},${r.total_cif}\n`);
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  async countriesCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const rows = (await pool.query(`
        SELECT COALESCE(s.origin_country,'Unknown') AS country,
               COUNT(*)::int AS shipments,
               COALESCE(SUM(s.cif_value_usd),0) AS total_cif
        FROM shipments s
        LEFT JOIN declarations d ON d.shipment_id = s.shipment_id
        WHERE ($1::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) >= $1::date)
          AND ($2::date IS NULL OR COALESCE(d.declaration_date, s.arrival_date) <= $2::date)
        GROUP BY COALESCE(s.origin_country,'Unknown')
        ORDER BY total_cif DESC
      `, [start, end])).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="top_countries.csv"');
      res.write('country,shipments,total_cif\n');
      for (const r of rows) res.write(`${r.country},${r.shipments},${r.total_cif}\n`);
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },

  async declarationsInvalidCsv(req, res) {
    try {
      const invalid = (await pool.query(
        `SELECT d.declaration_id, d.declaration_no, d.declaration_date, s.shipment_reference, i.company_name
         FROM declarations d
         JOIN shipments s ON d.shipment_id = s.shipment_id
         JOIN importers i ON s.importer_id = i.importer_id
         WHERE d.declaration_no IS NULL OR d.declaration_no = '' OR d.declaration_no !~ '^DEC-(ET-)?[0-9]{4}-[0-9]{4,6}$'`
      )).rows || [];

      const dup = (await pool.query(
        `WITH dup AS (
           SELECT declaration_no
           FROM declarations
           WHERE declaration_no IS NOT NULL AND declaration_no <> ''
           GROUP BY declaration_no HAVING COUNT(*) > 1
         )
         SELECT d.declaration_id, d.declaration_no, d.declaration_date, s.shipment_reference, i.company_name
         FROM declarations d
         JOIN dup x ON x.declaration_no = d.declaration_no
         JOIN shipments s ON d.shipment_id = s.shipment_id
         JOIN importers i ON s.importer_id = i.importer_id
         ORDER BY d.declaration_no`
      )).rows || [];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="declarations-invalid.csv"');
      const header = 'type,declaration_id,declaration_no,declaration_date,shipment_reference,company_name\n';
      res.write(header);
      const writeRow = (t, r) => res.write([
        t, r.declaration_id, r.declaration_no || '', r.declaration_date || '', r.shipment_reference || '', r.company_name || ''
      ].join(',') + '\n');
      for (const r of invalid) writeRow('invalid', r);
      for (const r of dup) writeRow('duplicate', r);
      res.end();
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  },

  async declarationsCsv(req, res) {
    try {
      const start = req.query?.start || null; // YYYY-MM-DD
      const end = req.query?.end || null;     // YYYY-MM-DD
      const station = req.query?.customs_station || null;
      const port = req.query?.destination_port || null;
      const status = req.query?.status || null; // Pending/Accepted/Rejected

      const filters = ["($1::date IS NULL OR d.declaration_date >= $1::date)",
                       "($2::date IS NULL OR d.declaration_date <= $2::date)"];
      const params = [start, end];
      if (station) { filters.push("d.customs_station = $" + (params.length + 1)); params.push(station); }
      if (port) { filters.push("s.destination_port = $" + (params.length + 1)); params.push(port); }
      if (status) { filters.push("d.status = $" + (params.length + 1)); params.push(status); }

      const sql = `
        SELECT d.declaration_id, d.declaration_no, d.declaration_date, d.status,
               d.customs_station, s.destination_port,
               s.shipment_reference, i.company_name
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE ${filters.join(" AND ")}
        ORDER BY d.declaration_date DESC, d.declaration_no ASC`;

      const rows = (await pool.query(sql, params)).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="declarations.csv"');
      res.write('declaration_id,declaration_no,declaration_date,status,customs_station,destination_port,shipment_reference,company_name\n');
      const esc = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
      };
      for (const r of rows) {
        res.write([
          r.declaration_id, esc(r.declaration_no), r.declaration_date, r.status || 'Pending', esc(r.customs_station), esc(r.destination_port), esc(r.shipment_reference), esc(r.company_name)
        ].join(',') + '\n');
      }
      res.end();
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  },

  async declarationsByStationCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const filters = ["($1::date IS NULL OR d.declaration_date >= $1::date)",
                       "($2::date IS NULL OR d.declaration_date <= $2::date)"];
      const params = [start, end];
      const sql = `
        SELECT COALESCE(d.customs_station,'Unknown') AS customs_station,
               COUNT(*)::int AS total,
               SUM(CASE WHEN d.status='Accepted' THEN 1 ELSE 0 END)::int AS accepted,
               SUM(CASE WHEN d.status='Rejected' THEN 1 ELSE 0 END)::int AS rejected,
               SUM(CASE WHEN d.status IS NULL OR d.status='Pending' THEN 1 ELSE 0 END)::int AS pending
        FROM declarations d
        WHERE ${filters.join(" AND ")}
        GROUP BY 1
        ORDER BY total DESC`;
      const rows = (await pool.query(sql, params)).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="declarations_by_station.csv"');
      res.write('customs_station,total,accepted,rejected,pending\n');
      for (const r of rows) res.write([r.customs_station, r.total, r.accepted, r.rejected, r.pending].join(',') + '\n');
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },

  async declarationsByPortCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const filters = ["($1::date IS NULL OR d.declaration_date >= $1::date)",
                       "($2::date IS NULL OR d.declaration_date <= $2::date)"];
      const params = [start, end];
      const sql = `
        SELECT COALESCE(s.destination_port,'Unknown') AS destination_port,
               COUNT(*)::int AS total,
               SUM(CASE WHEN d.status='Accepted' THEN 1 ELSE 0 END)::int AS accepted,
               SUM(CASE WHEN d.status='Rejected' THEN 1 ELSE 0 END)::int AS rejected,
               SUM(CASE WHEN d.status IS NULL OR d.status='Pending' THEN 1 ELSE 0 END)::int AS pending
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        WHERE ${filters.join(" AND ")}
        GROUP BY 1
        ORDER BY total DESC`;
      const rows = (await pool.query(sql, params)).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="declarations_by_port.csv"');
      res.write('destination_port,total,accepted,rejected,pending\n');
      for (const r of rows) res.write([r.destination_port, r.total, r.accepted, r.rejected, r.pending].join(',') + '\n');
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },

  async devicesCsv(_req, res) {
    try {
      const rows = (await pool.query(`
        SELECT gd.device_id, gd.shipment_id, gd.container_no, gd.transport_company, gd.driver_name, gd.driver_phone,
               gd.active, gd.registered_at,
               s.origin_country, s.destination_port,
               t.last_seen,
               EXTRACT(EPOCH FROM (now() - t.last_seen))/60.0 AS minutes_since_last,
               CASE WHEN gd.active AND t.last_seen IS NOT NULL AND (now() - t.last_seen) <= interval '30 minutes' THEN true ELSE false END AS online,
               loc.lat AS dest_lat, loc.lon AS dest_lon
        FROM gps_devices gd
        LEFT JOIN shipments s ON s.shipment_id = gd.shipment_id
        LEFT JOIN tracking t ON t.shipment_id = gd.shipment_id
        LEFT JOIN locations loc ON loc.name = s.destination_port
        ORDER BY gd.registered_at DESC
      `)).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="devices.csv"');
      res.write('device_id,shipment_id,container_no,transport_company,driver_name,driver_phone,active,registered_at,origin_country,destination_port,last_seen,minutes_since_last,online,dest_lat,dest_lon\n');
      const esc = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
      };
      for (const r of rows) {
        res.write([
          esc(r.device_id), esc(r.shipment_id), esc(r.container_no), esc(r.transport_company), esc(r.driver_name), esc(r.driver_phone),
          r.active ? 'true' : 'false', esc(r.registered_at), esc(r.origin_country), esc(r.destination_port), esc(r.last_seen),
          r.minutes_since_last != null ? Math.round(Number(r.minutes_since_last)) : '', r.online ? 'true' : 'false',
          r.dest_lat != null ? Number(r.dest_lat).toFixed(6) : '', r.dest_lon != null ? Number(r.dest_lon).toFixed(6) : ''
        ].join(',') + '\n');
      }
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  async clearanceAvgCsv(req, res) {
    try {
      const start = req.query?.start || null;
      const end = req.query?.end || null;
      const by = (req.query?.by || 'port').toString().toLowerCase();
      const groupKey = by === 'channel' ? 'COALESCE(i.risk_channel,\'UNKNOWN\')' : 'COALESCE(d.customs_station,\'N/A\')';
      const rows = (await pool.query(`
        SELECT ${groupKey} AS key,
               ROUND((AVG(EXTRACT(EPOCH FROM (c.release_date::timestamp - d.declaration_date::timestamp)))/86400.0)::numeric, 2) AS avg_days
        FROM declarations d
        JOIN clearances c ON c.declaration_id = d.declaration_id AND c.release_date IS NOT NULL
        LEFT JOIN inspections i ON i.declaration_id = d.declaration_id
        WHERE ($1::date IS NULL OR d.declaration_date >= $1::date)
          AND ($2::date IS NULL OR d.declaration_date <= $2::date)
        GROUP BY ${groupKey}
        ORDER BY avg_days ASC
      `, [start, end])).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="clearance_avg_${by}.csv"`);
      res.write('key,avg_days\n');
      for (const r of rows) res.write(`${r.key},${r.avg_days}\n`);
      res.end();
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  async dashboardPdf(req, res) {
    try {
      // Accept a snapshot payload to render
      const payload = req.body || {};
      const title = (payload.title || 'ECC Dashboard Snapshot');
      const now = new Date().toISOString();
      const esc = (s) => (s || '').toString().replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

      // Build minimal HTML using inline styles; avoid external assets
      const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin: 0 0 4px 0; font-size: 20px; }
        h2 { margin: 18px 0 6px; font-size: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; }
        th { background: #f3f4f6; text-align: left; }
        .muted { color: #666; font-size: 11px; }
      </style></head>
      <body>
        <h1>${esc(title)}</h1>
        <div class="muted">Generated at ${esc(now)}</div>

        <h2>Revenue Trends</h2>
        <table><thead><tr><th>Period</th><th>Total</th><th>Duty</th><th>VAT</th><th>Excise</th></tr></thead><tbody>
          ${(payload.rev || []).map(r=>`<tr><td>${esc(r.period)}</td><td>${esc(r.total)}</td><td>${esc(r.duty)}</td><td>${esc(r.vat)}</td><td>${esc(r.excise)}</td></tr>`).join('')}
        </tbody></table>

        <h2>Risk Channels</h2>
        <table><thead><tr><th>Channel</th><th>Count</th><th>Percent</th></tr></thead><tbody>
          ${(payload.risk || []).map(x=>`<tr><td>${esc(x.channel)}</td><td>${esc(x.count)}</td><td>${esc(x.percent)}%</td></tr>`).join('')}
        </tbody></table>

        <h2>Status Summary</h2>
        <table><tbody>
          ${payload.counts ? `<tr><th>Pending Payment</th><td>${esc(payload.counts.pending_payment)}</td></tr>
          <tr><th>Awaiting Inspection</th><td>${esc(payload.counts.awaiting_inspection)}</td></tr>
          <tr><th>Under Inspection</th><td>${esc(payload.counts.under_inspection)}</td></tr>
          <tr><th>Cleared</th><td>${esc(payload.counts.cleared)}</td></tr>
          <tr><th>Rejected</th><td>${esc(payload.counts.rejected)}</td></tr>`: ''}
        </tbody></table>

        <h2>Avg Clearance Time (by Port)</h2>
        <table><thead><tr><th>Port/Office</th><th>Avg Days</th></tr></thead><tbody>
          ${(payload.avgPort || []).map(r=>`<tr><td>${esc(r.key)}</td><td>${esc(r.avg_days)}</td></tr>`).join('')}
        </tbody></table>

        <h2>Top Goods (by CIF)</h2>
        <table><thead><tr><th>HS Code</th><th>Total CIF</th><th>Declarations</th></tr></thead><tbody>
          ${(payload.goods || []).map(g=>`<tr><td>${esc(g.hs_code)}</td><td>${esc(g.total_cif)}</td><td>${esc(g.declarations)}</td></tr>`).join('')}
        </tbody></table>

        <h2>Sector Volume</h2>
        <table><thead><tr><th>Sector</th><th>Shipments</th><th>Total CIF</th></tr></thead><tbody>
          ${(payload.sector || []).map(s=>`<tr><td>${esc(s.sector)}</td><td>${esc(s.shipments)}</td><td>${esc(s.total_cif)}</td></tr>`).join('')}
        </tbody></table>

        <h2>Top Countries</h2>
        <table><thead><tr><th>Country</th><th>Shipments</th><th>Total CIF</th></tr></thead><tbody>
          ${(payload.countries || []).map(c=>`<tr><td>${esc(c.country)}</td><td>${esc(c.shipments)}</td><td>${esc(c.total_cif)}</td></tr>`).join('')}
        </tbody></table>

        <h2>Forecast (next months)</h2>
        <table><thead><tr><th>Period</th><th>Predicted Total</th></tr></thead><tbody>
          ${((payload.forecast && payload.forecast.forecast) || []).map(f=>`<tr><td>${esc(f.period)}</td><td>${esc(f.pred_total)}</td></tr>`).join('')}
        </tbody></table>
      </body></html>`;

      let puppeteer;
      try { puppeteer = await import('puppeteer'); } catch (e) {
        return res.status(501).json({ message: "PDF generation requires 'puppeteer'. Please install it on the server." });
      }
      const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="dashboard.pdf"');
        return res.end(Buffer.from(pdf));
      } finally {
        await browser.close();
      }
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async riskyItemsCsv(req, res) {
    try {
      const since = req.query?.since || null;
      const minScore = Number.isFinite(Number(req.query?.min_score)) ? Number(req.query?.min_score) : 0;
      const hs = req.query?.hs_code || null;
      const port = req.query?.destination_port || null;
      const limit = Number.isFinite(Number(req.query?.limit)) ? Math.min(Number(req.query?.limit), 5000) : 1000;

      const filters = ["( $1::timestamptz IS NULL OR d.declaration_date >= $1::timestamptz )"];
      const params = [since];
      if (hs) { filters.push("gi.hs_code = $" + (params.length + 1)); params.push(String(hs)); }
      if (port) { filters.push("s.destination_port = $" + (params.length + 1)); params.push(String(port)); }

      const sql = `
        SELECT * FROM (
          SELECT gi.goods_item_id, gi.declaration_id, d.declaration_no, d.declaration_date,
                 gi.hs_code, gi.description, gi.quantity, gi.unit_of_measure, gi.value_usd,
                 COALESCE(NULLIF(gi.origin_country,''), s.origin_country) AS origin_country,
                 s.destination_port, s.mode_of_transport,
                 rif.value_ratio_vs_hs_p50, rif.undervaluation_flag, rif.overvaluation_flag,
                 rif.origin_watchlist_flag, rif.hs_prior_risk, rif.route_prior_risk,
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
        ) t
        WHERE t.risk_score >= $${params.length + 1}
        ORDER BY t.risk_score DESC, t.declaration_date DESC
        LIMIT ${limit}
      `;

      params.push(minScore);
      const rows = (await pool.query(sql, params)).rows || [];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="risky_items.csv"');
      res.write([
        'goods_item_id','declaration_id','declaration_no','declaration_date','hs_code','description','quantity','unit_of_measure','value_usd','origin_country','destination_port','mode_of_transport','value_ratio_vs_hs_p50','undervaluation_flag','overvaluation_flag','origin_watchlist_flag','hs_prior_risk','route_prior_risk','risk_score'
      ].join(',') + '\n');
      const esc = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
      };
      for (const r of rows) {
        res.write([
          r.goods_item_id, r.declaration_id, r.declaration_no, r.declaration_date,
          r.hs_code, esc(r.description), r.quantity, r.unit_of_measure, r.value_usd,
          r.origin_country, r.destination_port, r.mode_of_transport,
          r.value_ratio_vs_hs_p50, r.undervaluation_flag, r.overvaluation_flag,
          r.origin_watchlist_flag, r.hs_prior_risk, r.route_prior_risk, r.risk_score
        ].join(',') + '\n');
      }
      res.end();
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  },
};
