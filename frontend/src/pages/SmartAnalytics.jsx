import React, { Suspense, useEffect, useMemo, useState } from "react";
import { AnalyticsAPI } from "../api/analyticsAPI.js";
import { RiskAPI } from "../api/riskAPI.js";
import ChartCard from "../components/ChartCard.jsx";
import DataTable from "../components/DataTable.jsx";
import MetricCard from "../components/MetricCard.jsx";
import FilterBar from "../components/FilterBar.jsx";
import { useToast } from "../context/ToastContext.jsx";

const Bar = React.lazy(() => import("react-chartjs-2").then(async (m) => { await import("chart.js/auto"); return { default: m.Bar }; }));
const Pie = React.lazy(() => import("react-chartjs-2").then(async (m) => { await import("chart.js/auto"); return { default: m.Pie }; }));

const EMPTY_STATE = {
  revenue: [],
  riskChannels: [],
  pendingVsCleared: null,
  clearanceByPort: [],
  clearanceByChannel: [],
  goods: [],
  sectors: [],
  countries: [],
  forecast: { history: [], forecast: [] },
  anomalies: [],
  highRiskHs: [],
  riskyImporters: [],
  countryRisk: [],
  riskQueues: { high_risk_queue: [], medium_risk_queue: [], low_risk_queue: [] },
};

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value, digits = 0) {
  return n(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value) {
  return `ETB ${fmt(value, 2)}`;
}

function pct(value) {
  return `${fmt(value, 1)}%`;
}

function getRiskChannel(rows, name) {
  return (rows || []).find((row) => String(row.channel || "").toLowerCase() === name)?.percent || 0;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function optionValues(rows, key) {
  return Array.from(new Set(arrayOf(rows).map((row) => compactText(row?.[key])).filter((v) => v && v !== "-"))).sort();
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsToCsvSection(title, rows) {
  const list = arrayOf(rows);
  if (!list.length) return `${title}\nNo data\n`;
  const columns = Array.from(list.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  return [
    title,
    columns.join(","),
    ...list.map((row) => columns.map((column) => csvEscape(row?.[column])).join(",")),
  ].join("\n");
}

function downloadText(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toPairs(obj) {
  return obj ? Object.entries(obj).map(([metric, value]) => ({ metric, value })) : [];
}

function TableCard({ title, rows, columns, emptyText = "No data" }) {
  return (
    <section className="dashboard-card smart-analytics-table-card">
      <div className="smart-analytics-card-head">
        <h3>{title}</h3>
        <span>{arrayOf(rows).length} rows</span>
      </div>
      <div className="smart-analytics-table-wrap">
        <DataTable columns={columns} rows={arrayOf(rows)} dense emptyText={emptyText} />
      </div>
    </section>
  );
}

export default function SmartAnalytics() {
  const toast = useToast();
  const [filters, setFilters] = useState({ start: "", end: "" });
  const [drill, setDrill] = useState({ country: "", sector: "", channel: "", port: "", hs: "" });
  const [drillRows, setDrillRows] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [data, setData] = useState(EMPTY_STATE);

  const load = async () => {
    setLoading(true);
    setErrors({});

    const calls = [
      ["revenue", "Revenue trends", () => AnalyticsAPI.revenueTrends(filters)],
      ["riskChannels", "Risk channels", () => AnalyticsAPI.riskChannels(filters)],
      ["pendingVsCleared", "Workflow status", () => AnalyticsAPI.pendingVsCleared(filters)],
      ["clearanceByPort", "Clearance by customs station", () => AnalyticsAPI.clearanceAvg("port", filters)],
      ["clearanceByChannel", "Clearance by risk channel", () => AnalyticsAPI.clearanceAvg("channel", filters)],
      ["goods", "Goods summary", () => AnalyticsAPI.goodsSummary(filters)],
      ["sectors", "Sector volume", () => AnalyticsAPI.sectorVolume(filters)],
      ["countries", "Top origin countries", () => AnalyticsAPI.topCountries(filters)],
      ["forecast", "Revenue forecast", () => AnalyticsAPI.forecastRevenue(6, filters)],
      ["anomalies", "Low declaration anomalies", async () => {
        const result = await AnalyticsAPI.anomaliesLowDecls(filters);
        return arrayOf(result?.days);
      }],
      ["highRiskHs", "High-risk HS codes", () => AnalyticsAPI.highRiskHsCodes(filters)],
      ["riskyImporters", "Risky importers", () => AnalyticsAPI.topRiskyImporters(filters)],
      ["countryRisk", "Country risk", () => AnalyticsAPI.countryRiskHeatmap(filters)],
      ["riskQueues", "Risk queues", () => RiskAPI.queues({ limit: 100 })],
    ];

    const next = { ...EMPTY_STATE };
    const nextErrors = {};

    await Promise.all(
      calls.map(async ([key, label, fn]) => {
        try {
          next[key] = await fn();
        } catch (error) {
          next[key] = EMPTY_STATE[key];
          nextErrors[key] = error?.message || `${label} failed`;
        }
      })
    );

    setData(next);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast?.error?.("Some analytics data could not be loaded.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filters.start, filters.end]);

  useEffect(() => {
    let cancelled = false;
    const loadDrill = async () => {
      setDrillLoading(true);
      try {
        const rows = await AnalyticsAPI.declarations({
          start: filters.start,
          end: filters.end,
          country: drill.country,
          sector: drill.sector,
          channel: drill.channel,
          port: drill.port,
          hs: drill.hs,
        });
        if (!cancelled) setDrillRows(arrayOf(rows));
      } catch (error) {
        if (!cancelled) {
          setDrillRows([]);
          toast?.error?.(error?.message || "Declaration drill-down failed.");
        }
      } finally {
        if (!cancelled) setDrillLoading(false);
      }
    };
    loadDrill();
    return () => { cancelled = true; };
  }, [filters.start, filters.end, drill.country, drill.sector, drill.channel, drill.port, drill.hs]);

  const summary = useMemo(() => {
    const revenueTotal = arrayOf(data.revenue).reduce((sum, row) => sum + n(row.total), 0);
    const workflow = data.pendingVsCleared || {};
    const workflowTotal =
      n(workflow.pending_payment) +
      n(workflow.awaiting_inspection) +
      n(workflow.under_inspection) +
      n(workflow.cleared) +
      n(workflow.rejected);
    const queueTotal =
      arrayOf(data.riskQueues?.high_risk_queue).length +
      arrayOf(data.riskQueues?.medium_risk_queue).length +
      arrayOf(data.riskQueues?.low_risk_queue).length;
    const avgClearance = arrayOf(data.clearanceByPort).length
      ? arrayOf(data.clearanceByPort).reduce((sum, row) => sum + n(row.avg_days), 0) / data.clearanceByPort.length
      : 0;

    return {
      revenueTotal,
      redPercent: getRiskChannel(data.riskChannels, "red"),
      greenPercent: getRiskChannel(data.riskChannels, "green"),
      workflowTotal,
      cleared: n(workflow.cleared),
      clearanceRate: workflowTotal ? (n(workflow.cleared) / workflowTotal) * 100 : 0,
      queueTotal,
      avgClearance,
      topSector: arrayOf(data.sectors)[0],
      topCountry: arrayOf(data.countries)[0],
      topRiskImporter: arrayOf(data.riskyImporters)[0],
      topHs: arrayOf(data.highRiskHs)[0],
    };
  }, [data]);

  const insights = useMemo(() => {
    const out = [];
    if (summary.redPercent >= 25) out.push(`High red-channel share: ${pct(summary.redPercent)} of declarations need closer control.`);
    if (summary.greenPercent >= 50) out.push(`Green-channel processing is dominant at ${pct(summary.greenPercent)}.`);
    if (summary.clearanceRate < 50 && summary.workflowTotal > 0) out.push(`Clearance completion is below target at ${pct(summary.clearanceRate)}.`);
    if (summary.queueTotal > 0) out.push(`${summary.queueTotal} declarations are still in risk queues.`);
    if (arrayOf(data.anomalies).length) out.push(`${data.anomalies.length} low-declaration anomaly days need review.`);
    if (!out.length) out.push("No urgent analytics warnings in the selected date range.");
    return out;
  }, [data, summary]);

  const riskQueueRows = useMemo(() => {
    const shape = (rows, priority) => arrayOf(rows).map((row) => ({ ...row, priority }));
    return [
      ...shape(data.riskQueues?.high_risk_queue, "High"),
      ...shape(data.riskQueues?.medium_risk_queue, "Medium"),
      ...shape(data.riskQueues?.low_risk_queue, "Low"),
    ];
  }, [data.riskQueues]);

  const drillOptions = useMemo(() => ({
    countries: optionValues(data.countries.length ? data.countries : data.countryRisk, "country"),
    sectors: optionValues(data.sectors, "sector"),
    channels: optionValues(data.riskChannels, "channel"),
    ports: optionValues(data.clearanceByPort, "key"),
    hsCodes: optionValues(data.goods.length ? data.goods : data.highRiskHs, "hs_code"),
  }), [data]);

  const exportSections = useMemo(() => ([
    ["Workflow Status", toPairs(data.pendingVsCleared)],
    ["Risk Channels", data.riskChannels],
    ["Revenue Trends", data.revenue],
    ["Revenue Forecast", arrayOf(data.forecast?.forecast)],
    ["Clearance By Station", data.clearanceByPort],
    ["Clearance By Channel", data.clearanceByChannel],
    ["Sector Volume", data.sectors],
    ["Top Countries", data.countries],
    ["Goods Summary", data.goods],
    ["Low Declaration Anomalies", data.anomalies],
    ["High-Risk HS Codes", data.highRiskHs],
    ["Top Risky Importers", data.riskyImporters],
    ["Country Risk", data.countryRisk],
    ["Risk Queues", riskQueueRows],
    ["Declaration Drill Down", drillRows],
  ]), [data, riskQueueRows, drillRows]);

  const exportCsv = () => {
    const csv = exportSections.map(([title, rows]) => rowsToCsvSection(title, rows)).join("\n\n");
    downloadText("smart-analytics.csv", "text/csv;charset=utf-8", csv);
    toast?.success?.("Smart Analytics CSV exported.");
  };

  const exportPdf = () => {
    const sectionHtml = exportSections.map(([title, rows]) => {
      const list = arrayOf(rows).slice(0, 100);
      const columns = Array.from(list.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set()));
      const head = columns.map((column) => `<th>${htmlEscape(column)}</th>`).join("");
      const body = list.map((row) => `<tr>${columns.map((column) => `<td>${htmlEscape(row?.[column])}</td>`).join("")}</tr>`).join("");
      return `<h2>${htmlEscape(title)}</h2>${list.length ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` : "<p>No data</p>"}`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Smart Analytics</title><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#0f172a} h1{margin:0 0 12px} h2{font-size:15px;margin:18px 0 6px}
      table{width:100%;border-collapse:collapse;font-size:10px;page-break-inside:auto} th,td{border:1px solid #dbe3ef;padding:4px;text-align:left}
      th{background:#f1f5f9} tr{page-break-inside:avoid}
    </style></head><body><h1>Smart Analytics</h1><p>${filters.start || "Any start"} to ${filters.end || "Any end"}</p>${sectionHtml}<script>window.onload=()=>window.print()<\/script></body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
  };

  return (
    <div className="smart-analytics-page-shell">
      <div className="smart-analytics-page-panel">
        <div className="smart-analytics-page-top">
          <div className="smart-analytics-page-heading">
            <div className="smart-analytics-page-kicker">Intelligence</div>
            <h1>Smart Analytics</h1>
            <p>All customs intelligence in one view: revenue, risk, clearance, sectors, countries, forecasts, anomalies, and queues.</p>
          </div>
          <div className="smart-analytics-actions">
            <button type="button" className="eu-btn" onClick={exportCsv}>CSV</button>
            <button type="button" className="eu-btn" onClick={exportPdf}>PDF</button>
            <button type="button" className="eu-btn primary" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        />

        {Object.keys(errors).length > 0 && (
          <div className="analytics-error">
            Partial load: {Object.values(errors).slice(0, 3).join("; ")}
          </div>
        )}

        <div className="dashboard-grid dashboard-metrics">
          <MetricCard title="Total Revenue" value={money(summary.revenueTotal)} helper="Paid duties, VAT, and excise" />
          <MetricCard title="Clearance Rate" value={pct(summary.clearanceRate)} helper={`${fmt(summary.cleared)} cleared of ${fmt(summary.workflowTotal)}`} deltaTone="up" />
          <MetricCard title="Red Channel" value={pct(summary.redPercent)} helper="High-risk declaration share" deltaTone="down" />
          <MetricCard title="Risk Queue" value={fmt(summary.queueTotal)} helper="High, medium, and low queue total" />
          <MetricCard title="Avg Clearance" value={`${fmt(summary.avgClearance, 1)} days`} helper="Average by customs station" />
        </div>

        <section className="dashboard-card smart-analytics-insights">
          <div className="smart-analytics-card-head">
            <h3>Smart Observations</h3>
            <span>{filters.start || "Any start"} to {filters.end || "Any end"}</span>
          </div>
          <div className="smart-analytics-insight-grid">
            {insights.map((item) => (
              <div key={item} className="smart-analytics-insight">{item}</div>
            ))}
          </div>
        </section>

        <section className="chart-grid analytics-section">
          <ChartCard title="Risk Channel Share">
            <div className="dashboard-chart smart-analytics-chart">
              <Suspense fallback={<div>Loading chart...</div>}>
                <Pie
                  options={chartOptions}
                  data={{
                    labels: arrayOf(data.riskChannels).map((r) => r.channel),
                    datasets: [{
                      data: arrayOf(data.riskChannels).map((r) => n(r.count)),
                      backgroundColor: ["#16a34a", "#facc15", "#dc2626"],
                    }],
                  }}
                />
              </Suspense>
            </div>
          </ChartCard>
          <ChartCard title="Top Sectors By CIF">
            <div className="dashboard-chart smart-analytics-chart">
              <Suspense fallback={<div>Loading chart...</div>}>
                <Bar
                  options={chartOptions}
                  data={{
                    labels: arrayOf(data.sectors).slice(0, 8).map((r) => r.sector),
                    datasets: [{
                      label: "CIF USD",
                      data: arrayOf(data.sectors).slice(0, 8).map((r) => n(r.total_cif)),
                      backgroundColor: "#7ba8d8",
                    }],
                  }}
                />
              </Suspense>
            </div>
          </ChartCard>
          <ChartCard title="Clearance Days By Station">
            <div className="dashboard-chart smart-analytics-chart">
              <Suspense fallback={<div>Loading chart...</div>}>
                <Bar
                  options={{ ...chartOptions, indexAxis: "y" }}
                  data={{
                    labels: arrayOf(data.clearanceByPort).slice(0, 10).map((r) => r.key),
                    datasets: [{
                      label: "Avg days",
                      data: arrayOf(data.clearanceByPort).slice(0, 10).map((r) => n(r.avg_days)),
                      backgroundColor: "#245f94",
                    }],
                  }}
                />
              </Suspense>
            </div>
          </ChartCard>
        </section>

        <section className="dashboard-card analytics-info-grid">
          <div className="analytics-info-item">
            <div className="analytics-info-label">Top Sector</div>
            <div className="analytics-info-value">{summary.topSector?.sector || "-"}</div>
            <div className="analytics-info-sub">{fmt(summary.topSector?.shipments)} shipments, CIF {fmt(summary.topSector?.total_cif, 2)}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">Top Origin Country</div>
            <div className="analytics-info-value">{summary.topCountry?.country || "-"}</div>
            <div className="analytics-info-sub">{fmt(summary.topCountry?.shipments)} shipments, CIF {fmt(summary.topCountry?.total_cif, 2)}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">Top Risk Importer</div>
            <div className="analytics-info-value">{summary.topRiskImporter?.company_name || "-"}</div>
            <div className="analytics-info-sub">Avg risk {fmt(summary.topRiskImporter?.avg_risk_score, 1)}, red {fmt(summary.topRiskImporter?.red_count)}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">Top High-Risk HS</div>
            <div className="analytics-info-value">{summary.topHs?.hs_code || "-"}</div>
            <div className="analytics-info-sub">{fmt(summary.topHs?.declarations)} declarations, CIF {fmt(summary.topHs?.total_cif, 2)}</div>
          </div>
        </section>

        <section className="dashboard-card smart-analytics-drill">
          <div className="smart-analytics-card-head">
            <h3>Declaration Drill Down</h3>
            <span>{drillLoading ? "Loading..." : `${drillRows.length} declarations`}</span>
          </div>
          <div className="smart-analytics-drill-controls">
            <label>
              <span>Country</span>
              <select value={drill.country} onChange={(e) => setDrill((prev) => ({ ...prev, country: e.target.value }))}>
                <option value="">All</option>
                {drillOptions.countries.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Sector</span>
              <select value={drill.sector} onChange={(e) => setDrill((prev) => ({ ...prev, sector: e.target.value }))}>
                <option value="">All</option>
                {drillOptions.sectors.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Risk Channel</span>
              <select value={drill.channel} onChange={(e) => setDrill((prev) => ({ ...prev, channel: e.target.value }))}>
                <option value="">All</option>
                {drillOptions.channels.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Station</span>
              <select value={drill.port} onChange={(e) => setDrill((prev) => ({ ...prev, port: e.target.value }))}>
                <option value="">All</option>
                {drillOptions.ports.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>HS Code</span>
              <select value={drill.hs} onChange={(e) => setDrill((prev) => ({ ...prev, hs: e.target.value }))}>
                <option value="">All</option>
                {drillOptions.hsCodes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button type="button" className="eu-btn" onClick={() => setDrill({ country: "", sector: "", channel: "", port: "", hs: "" })}>Clear</button>
          </div>
          <div className="smart-analytics-table-wrap">
            <DataTable
              dense
              rows={drillRows}
              emptyText="No declarations match the selected filters"
              columns={[
                { key: "declaration_no", label: "Declaration" },
                { key: "declaration_date", label: "Date", render: (r) => compactText(r.declaration_date).slice(0, 10) },
                { key: "company_name", label: "Importer" },
                { key: "origin_country", label: "Country" },
                { key: "sector_type", label: "Sector" },
                { key: "risk_channel", label: "Channel" },
                { key: "risk_score", label: "Risk", align: "right", render: (r) => fmt(r.risk_score) },
                { key: "cif_value_usd", label: "CIF USD", align: "right", render: (r) => fmt(r.cif_value_usd, 2) },
              ]}
            />
          </div>
        </section>

        <div className="smart-analytics-table-grid">
          <TableCard
            title="Workflow Status"
            rows={data.pendingVsCleared ? Object.entries(data.pendingVsCleared).map(([status, count]) => ({ status, count })) : []}
            columns={[
              { key: "status", label: "Status", render: (r) => compactText(r.status).replaceAll("_", " ") },
              { key: "count", label: "Count", align: "right", render: (r) => fmt(r.count) },
            ]}
          />
          <TableCard
            title="Risk Channels"
            rows={data.riskChannels}
            columns={[
              { key: "channel", label: "Channel" },
              { key: "count", label: "Count", align: "right", render: (r) => fmt(r.count) },
              { key: "percent", label: "Percent", align: "right", render: (r) => pct(r.percent) },
            ]}
          />
          <TableCard
            title="Revenue Trends"
            rows={data.revenue}
            columns={[
              { key: "period", label: "Period" },
              { key: "duty", label: "Duty", align: "right", render: (r) => fmt(r.duty, 2) },
              { key: "vat", label: "VAT", align: "right", render: (r) => fmt(r.vat, 2) },
              { key: "excise", label: "Excise", align: "right", render: (r) => fmt(r.excise, 2) },
              { key: "total", label: "Total", align: "right", render: (r) => fmt(r.total, 2) },
            ]}
          />
          <TableCard
            title="Revenue Forecast"
            rows={arrayOf(data.forecast?.forecast)}
            columns={[
              { key: "period", label: "Period" },
              { key: "pred_total", label: "Forecast", align: "right", render: (r) => fmt(r.pred_total, 2) },
            ]}
          />
          <TableCard
            title="Clearance By Station"
            rows={data.clearanceByPort}
            columns={[
              { key: "key", label: "Station" },
              { key: "avg_days", label: "Avg Days", align: "right", render: (r) => fmt(r.avg_days, 1) },
            ]}
          />
          <TableCard
            title="Clearance By Channel"
            rows={data.clearanceByChannel}
            columns={[
              { key: "key", label: "Channel" },
              { key: "avg_days", label: "Avg Days", align: "right", render: (r) => fmt(r.avg_days, 1) },
            ]}
          />
          <TableCard
            title="Sector Volume"
            rows={data.sectors}
            columns={[
              { key: "sector", label: "Sector" },
              { key: "shipments", label: "Shipments", align: "right", render: (r) => fmt(r.shipments) },
              { key: "declarations", label: "Declarations", align: "right", render: (r) => fmt(r.declarations) },
              { key: "total_cif", label: "CIF USD", align: "right", render: (r) => fmt(r.total_cif, 2) },
            ]}
          />
          <TableCard
            title="Top Countries"
            rows={data.countries}
            columns={[
              { key: "country", label: "Country" },
              { key: "shipments", label: "Shipments", align: "right", render: (r) => fmt(r.shipments) },
              { key: "total_cif", label: "CIF USD", align: "right", render: (r) => fmt(r.total_cif, 2) },
            ]}
          />
          <TableCard
            title="Goods Summary"
            rows={data.goods}
            columns={[
              { key: "hs_code", label: "HS Code" },
              { key: "declarations", label: "Declarations", align: "right", render: (r) => fmt(r.declarations) },
              { key: "total_cif", label: "CIF USD", align: "right", render: (r) => fmt(r.total_cif, 2) },
            ]}
          />
          <TableCard
            title="Low Declaration Anomalies"
            rows={data.anomalies}
            columns={[
              { key: "day", label: "Day", render: (r) => compactText(r.day).slice(0, 10) },
              { key: "cnt", label: "Declarations", align: "right", render: (r) => fmt(r.cnt) },
              { key: "avg_cnt", label: "Average", align: "right", render: (r) => fmt(r.avg_cnt, 1) },
              { key: "is_anomaly", label: "Anomaly", render: (r) => (r.is_anomaly ? "Yes" : "No") },
            ]}
          />
          <TableCard
            title="High-Risk HS Codes"
            rows={data.highRiskHs}
            columns={[
              { key: "hs_code", label: "HS Code" },
              { key: "declarations", label: "Declarations", align: "right", render: (r) => fmt(r.declarations) },
              { key: "avg_risk_score", label: "Avg Risk", align: "right", render: (r) => fmt(r.avg_risk_score, 1) },
              { key: "total_cif", label: "CIF USD", align: "right", render: (r) => fmt(r.total_cif, 2) },
            ]}
          />
          <TableCard
            title="Top Risky Importers"
            rows={data.riskyImporters}
            columns={[
              { key: "company_name", label: "Importer" },
              { key: "declarations", label: "Declarations", align: "right", render: (r) => fmt(r.declarations) },
              { key: "avg_risk_score", label: "Avg Risk", align: "right", render: (r) => fmt(r.avg_risk_score, 1) },
              { key: "red_count", label: "Red", align: "right", render: (r) => fmt(r.red_count) },
            ]}
          />
          <TableCard
            title="Country Risk"
            rows={data.countryRisk}
            columns={[
              { key: "country", label: "Country" },
              { key: "declarations", label: "Declarations", align: "right", render: (r) => fmt(r.declarations) },
              { key: "avg_risk_score", label: "Avg Risk", align: "right", render: (r) => fmt(r.avg_risk_score, 1) },
              { key: "red_count", label: "Red", align: "right", render: (r) => fmt(r.red_count) },
            ]}
          />
          <TableCard
            title="Risk Queues"
            rows={riskQueueRows}
            columns={[
              { key: "priority", label: "Priority" },
              { key: "declaration_no", label: "Declaration" },
              { key: "company_name", label: "Importer" },
              { key: "risk_score", label: "Risk", align: "right", render: (r) => fmt(r.risk_score) },
              { key: "risk_channel", label: "Channel" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
