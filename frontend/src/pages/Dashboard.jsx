import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { AnalyticsAPI } from "../api/analyticsAPI.js";
import { RiskAPI } from "../api/riskAPI.js";
import hsCodes from "../data/hs-codes.json";
import WorldMap from "../components/WorldMap.jsx";
import FilterBar from "../components/FilterBar.jsx";
import MetricCard from "../components/MetricCard.jsx";
import ChartCard from "../components/ChartCard.jsx";
import ExportActions from "../components/ExportActions.jsx";
import DataTable from "../components/DataTable.jsx";
import { SkeletonText } from "../components/Skeleton.jsx";
import RiskBadge from "../components/RiskBadge.jsx";

const Line = React.lazy(() => import("react-chartjs-2").then(async (m) => { await import("chart.js/auto"); return { default: m.Line }; }));
const Bar = React.lazy(() => import("react-chartjs-2").then(async (m) => { await import("chart.js/auto"); return { default: m.Bar }; }));
const Pie = React.lazy(() => import("react-chartjs-2").then(async (m) => { await import("chart.js/auto"); return { default: m.Pie }; }));

const CHART_H = 260;
const API_BASE = (import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api");

function formatMoney(n) { try { return Number(n || 0).toLocaleString(); } catch { return n; } }
function formatDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

export default function Dashboard() {
  const { role, token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rev, setRev] = useState([]);
  const [risk, setRisk] = useState([]);
  const [counts, setCounts] = useState(null);
  const [avgPort, setAvgPort] = useState([]);
  const [sector, setSector] = useState([]);
  const [countries, setCountries] = useState([]);
  const [forecast, setForecast] = useState({ forecast: [] });
  const [goods, setGoods] = useState([]);
  const [highRiskHs, setHighRiskHs] = useState([]);
  const [topRiskImporters, setTopRiskImporters] = useState([]);
  const [countryRiskHeat, setCountryRiskHeat] = useState([]);
  const [riskQueues, setRiskQueues] = useState({ high_risk_queue: [], medium_risk_queue: [], low_risk_queue: [] });
  const [exporting, setExporting] = useState({});
  const [chartH, setChartH] = useState(CHART_H);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setErr("");
      try {
        const [revR, riskR, countsR, avgPortR, sectorR, countriesR, forecastR, goodsR, highRiskHsR, topRiskImportersR, countryRiskHeatR, queuesR] = await Promise.all([
          AnalyticsAPI.revenueTrends(filters),
          AnalyticsAPI.riskChannels(filters),
          AnalyticsAPI.pendingVsCleared(filters),
          AnalyticsAPI.clearanceAvg("port", filters),
          AnalyticsAPI.sectorVolume(filters),
          AnalyticsAPI.topCountries(filters),
          AnalyticsAPI.forecastRevenue(3, filters),
          AnalyticsAPI.goodsSummary(filters),
          AnalyticsAPI.highRiskHsCodes(filters),
          AnalyticsAPI.topRiskyImporters(filters),
          AnalyticsAPI.countryRiskHeatmap(filters),
          RiskAPI.queues({ limit: 100 }).catch(() => ({ high_risk_queue: [], medium_risk_queue: [], low_risk_queue: [] })),
        ]);
        setRev(revR || []);
        setRisk(riskR || []);
        setCounts(countsR || null);
        setAvgPort(avgPortR || []);
        setSector(sectorR || []);
        setCountries(countriesR || []);
        setForecast(forecastR || { forecast: [] });
        setGoods(goodsR || []);
        setHighRiskHs(highRiskHsR || []);
        setTopRiskImporters(topRiskImportersR || []);
        setCountryRiskHeat(countryRiskHeatR || []);
        setRiskQueues({
          high_risk_queue: Array.isArray(queuesR?.high_risk_queue) ? queuesR.high_risk_queue : [],
          medium_risk_queue: Array.isArray(queuesR?.medium_risk_queue) ? queuesR.medium_risk_queue : [],
          low_risk_queue: Array.isArray(queuesR?.low_risk_queue) ? queuesR.low_risk_queue : [],
        });
      } catch (e) {
        setErr(e.message || t("failedToLoadAnalytics"));
      } finally {
        setLoading(false);
      }
    };
    if (role !== "Importer") load();
  }, [role, filters.start, filters.end]);

  // Responsive chart height
  useEffect(() => {
    const updateH = () => {
      try {
        const w = window.innerWidth || 1200;
        setChartH(w < 720 ? 220 : CHART_H);
      } catch {}
    };
    updateH();
    window.addEventListener("resize", updateH);
    return () => window.removeEventListener("resize", updateH);
  }, []);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const totalRevenue = (rev || []).reduce((a, x) => a + toNum(x.total), 0);
  const greenPct = toNum(risk.find((r) => r.channel?.toLowerCase() === "green")?.percent);
  const yellowPct = toNum(risk.find((r) => r.channel?.toLowerCase() === "yellow")?.percent);
  const redPct = toNum(risk.find((r) => r.channel?.toLowerCase() === "red")?.percent);
  const clearanceRate = counts ? Math.round((Number(counts.cleared || 0) / Math.max(1, Number(counts.cleared || 0) + Number(counts.pending_payment || 0) + Number(counts.awaiting_inspection || 0) + Number(counts.under_inspection || 0) + Number(counts.rejected || 0))) * 100) : 0;
  const queueTotal = riskQueues.high_risk_queue.length + riskQueues.medium_risk_queue.length + riskQueues.low_risk_queue.length;
  const avgClearanceDays = avgPort.length ? (avgPort.reduce((sum, row) => sum + Number(row.avg_days || 0), 0) / Math.max(1, avgPort.length)) : 0;
  const topRiskImporter = topRiskImporters[0];
  const topRiskHsCode = highRiskHs[0];
  const topRiskCountry = countryRiskHeat[0];

  const exportBtn = (filename, path, extra = {}, method = "GET") => (
    <ExportActions actions={[{
      label: exporting[path] ? t("exporting") : "Export CSV",
      disabled: !!exporting[path],
      onClick: () => downloadCsv(filename, path, extra, method)
    }]} />
  );

  const exportAll = async () => {
    const paths = [
      ['dashboard.pdf', '/export/dashboard.pdf', {}, 'POST'],
      ['revenue.csv', '/export/revenue.csv', filters, 'GET'],
      ['risk_channels.csv', '/export/risk-channels.csv', filters, 'GET'],
      ['sector_volume.csv', '/export/sector-volume.csv', filters, 'GET'],
      ['top_countries.csv', '/export/top-countries.csv', filters, 'GET'],
      ['clearance_avg_port.csv', '/export/clearance-avg.csv', { ...filters, by: 'port' }, 'GET'],
      ['pending_vs_cleared.csv', '/export/pending-cleared.csv', filters, 'GET'],
      ['goods.csv', '/export/goods.csv', { start: filters.start, end: filters.end }, 'GET'],
    ];
    try {
      setExporting((m) => ({ ...m, __all: true }));
      for (const [fname, path, params, method] of paths) {
        await downloadCsv(fname, path, params, method, { silentSuccess: true });
      }
      toast?.success(t("allExportsReady"));
    } catch (e) {
      toast?.error?.(e.message || t("exportAllFailed"));
    } finally {
      setExporting((m) => { const next = { ...m }; delete next.__all; return next; });
    }
  };

  const downloadCsv = async (filename, path, params, method = "GET", options = {}) => {
    try {
      setExporting((m) => ({ ...m, [path]: true }));
      const q = new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v)).toString();
      const isGet = method.toUpperCase() === "GET";
      const url = `${API_BASE}${path}${isGet && q ? `?${q}` : ''}`;
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (!isGet) headers["Content-Type"] = "application/json";
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: isGet ? undefined : JSON.stringify(params || {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename; a.click();
      URL.revokeObjectURL(blobUrl);
      if (!options.silentSuccess) toast?.success(`${t("exportReady")}: ${filename}`);
    } catch (e) {
      toast?.error?.(e.message || t("csvDownloadFailed"));
    } finally {
      setExporting((m) => {
        const next = { ...m }; delete next[path]; return next;
      });
    }
  };

  return (
    <div className="analytics-page">
      <div className="page-header">
        {role !== 'Importer' && (
          <div className="actions">
            <details className="export-menu">
              <summary className="export-btn analytics-export-summary">
                {exporting.__all ? t("exporting") : t("exports")}
              </summary>
              <div className="export-menu-panel">
                <ExportActions actions={[
                  { label: "Dashboard PDF", onClick: () => downloadCsv('dashboard.pdf', '/export/dashboard.pdf', {}, 'POST') },
                  { label: t("exportAllCsv"), onClick: exportAll, disabled: !!exporting.__all },
                  { label: t("revenueCsv"), onClick: () => downloadCsv('revenue.csv', '/export/revenue.csv', filters) },
                  { label: t("riskCsv"), onClick: () => downloadCsv('risk_channels.csv', '/export/risk-channels.csv', filters) },
                  { label: t("sectorCsv"), onClick: () => downloadCsv('sector_volume.csv', '/export/sector-volume.csv', filters) },
                  { label: t("countriesCsv"), onClick: () => downloadCsv('top_countries.csv', '/export/top-countries.csv', filters) },
                  { label: t("clearanceAvgCsv"), onClick: () => downloadCsv('clearance_avg_port.csv', '/export/clearance-avg.csv', { ...filters, by: 'port' }) },
                  { label: t("pendingVsClearedCsv"), onClick: () => downloadCsv('pending_vs_cleared.csv', '/export/pending-cleared.csv', filters) },
                  { label: "Goods CSV", onClick: () => downloadCsv('goods.csv', '/export/goods.csv', { start: filters.start, end: filters.end }) },
                ]} />
              </div>
            </details>
          </div>
        )}
      </div>

      <FilterBar
        filters={filters}
        onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
      />
      {err && <div className="analytics-error">{t("failedToLoadAnalyticsPrefix")} {err}</div>}

      <div className="dashboard-grid dashboard-metrics">
        <MetricCard title={t("totalRevenue")} value={`ETB ${formatMoney(totalRevenue)}`} delta={rev.length ? `${rev[rev.length-1]?.period || ''}` : ''} helper={t("allDutiesVatExcise")} deltaTone="up" tooltip="Sum of duty, VAT, excise for the selected period" />
        <MetricCard title={t("greenChannelPercent")} value={`${greenPct.toFixed(1)}%`} helper={t("lowRiskShare")} deltaTone="up" tooltip="Shipments cleared via green channel" />
        <MetricCard title={t("yellowChannelPercent")} value={`${yellowPct.toFixed(1)}%`} helper={t("mediumRiskShare")} deltaTone="neutral" tooltip="Shipments routed to yellow channel" />
        <MetricCard title={t("redChannelPercent")} value={`${redPct.toFixed(1)}%`} helper={t("highRiskShare")} deltaTone="down" tooltip="Shipments in red (high-risk) channel" />
        <MetricCard title={t("clearanceRate")} value={`${clearanceRate.toFixed(0)}%`} helper={t("clearedOverTotal")} deltaTone="up" tooltip="Cleared vs total declarations" />
      </div>

      <section className="analytics-block">
        <div className="dashboard-card analytics-info-grid">
          <div className="analytics-info-item">
            <div className="analytics-info-label">{t("queueCoverage")}</div>
            <div className="analytics-info-value">{queueTotal}</div>
            <div className="analytics-info-sub">{t("totalDeclsInRiskQueues")}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">{t("topRiskImporter")}</div>
            <div className="analytics-info-value">{topRiskImporter?.company_name || "-"}</div>
            <div className="analytics-info-sub">Avg risk {formatDays(topRiskImporter?.avg_risk_score || 0)} | Red {Number(topRiskImporter?.red_count || 0)}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">{t("topRiskHs")}</div>
            <div className="analytics-info-value">{topRiskHsCode?.hs_code || "-"}</div>
            <div className="analytics-info-sub">Red {Number(topRiskHsCode?.declarations || 0)} | Avg risk {formatDays(topRiskHsCode?.avg_risk_score || 0)}</div>
          </div>
          <div className="analytics-info-item">
            <div className="analytics-info-label">{t("topRiskCountry")}</div>
            <div className="analytics-info-value">{topRiskCountry?.country || "-"}</div>
            <div className="analytics-info-sub">Red {Number(topRiskCountry?.red_count || 0)} | Avg risk {formatDays(topRiskCountry?.avg_risk_score || 0)}</div>
          </div>
        </div>
      </section>

      <section className="chart-grid analytics-section analytics-block">
        <ChartCard title={t("taxRevenueTrends")} actions={exportBtn('revenue.csv', '/export/revenue.csv', filters)}>
          {(() => {
            if (loading) return <SkeletonText lines={4} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadRevenueData")}</div>;
            if (!rev?.length) return <SkeletonText lines={4} />;
            return (
              <Suspense fallback={<SkeletonText lines={4} />}>
                <div className="dashboard-chart">
                  <Line height={chartH} data={{
                    labels: rev.map(r => r.period),
                    datasets: [
                      { label: 'Total', data: rev.map(r => r.total), borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.16)', tension: 0.25 },
                      { label: 'Duty', data: rev.map(r => r.duty), borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.16)', tension: 0.25 },
                      { label: 'VAT', data: rev.map(r => r.vat), borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.16)', tension: 0.25 },
                      { label: 'Excise', data: rev.map(r => r.excise), borderColor: '#6c757d', backgroundColor: 'rgba(108,117,125,0.14)', tension: 0.25 },
                    ]
                  }} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </Suspense>
            );
          })()}
        </ChartCard>

        <ChartCard title={t("riskChannelDistribution")} actions={exportBtn('risk_channels.csv', '/export/risk-channels.csv', filters)}>
          {(() => {
            if (loading) return <SkeletonText lines={4} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadRiskData")}</div>;
            if (!risk?.length) return <SkeletonText lines={3} />;
            return (
              <div>
                <Suspense fallback={<SkeletonText lines={3} />}>
                  <div className="dashboard-chart">
                    <Pie height={Math.round(chartH * 0.75)} data={{
                      labels: risk.map(x => x.channel),
                      datasets: [{
                        label: 'Share %',
                        data: risk.map(x => x.percent),
                        backgroundColor: ['#16a34a', '#facc15', '#dc2626', '#7da6d9']
                      }]
                    }} options={{ maintainAspectRatio: false }} />
                  </div>
                </Suspense>
                <div className="dashboard-legend">
                  {risk.map((c, i) => (
                    <button key={i}>{c.channel}: {c.count}</button>
                  ))}
                </div>
              </div>
            );
          })()}
        </ChartCard>

        <ChartCard title={t("pendingVsCleared")} actions={exportBtn('pending_vs_cleared.csv', '/export/pending-cleared.csv', filters)}>
          {(() => {
            if (loading) return <SkeletonText lines={3} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadCounts")}</div>;
            if (!counts) return <SkeletonText lines={3} />;
            return (
              <Suspense fallback={<SkeletonText lines={3} />}>
                <div className="dashboard-chart">
                <Bar height={chartH} data={{
                    labels: ['Pending Payment','Awaiting Inspection','Under Inspection','Cleared','Rejected'],
                    datasets: [{
                      label: 'Count',
                      data: [counts.pending_payment, counts.awaiting_inspection, counts.under_inspection, counts.cleared, counts.rejected],
                       backgroundColor: ['#0d6efd','#facc15','#6c757d','#198754','#dc2626']
                    }]
                  }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </Suspense>
            );
          })()}
        </ChartCard>

      </section>

      <section className="chart-grid analytics-section analytics-block">
        <ChartCard title={t("topTradingCountries")} actions={exportBtn('top_countries.csv', '/export/top-countries.csv', filters)}>
          <div className="analytics-map-wrap">
            <WorldMap data={countries} />
          </div>
          {(() => {
            if (loading) return <SkeletonText lines={3} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadCountryData")}</div>;
            if (!countries?.length) return <SkeletonText lines={3} />;
            return (
              <Suspense fallback={<SkeletonText lines={3} />}>
                <div className="dashboard-chart">
                    <Bar height={Math.round(chartH * 0.85)} data={{
                    labels: countries.map(c => c.country),
                    datasets: [{ label: 'CIF (USD)', data: countries.map(c => c.total_cif), backgroundColor: '#6f7bff' }]
                  }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </Suspense>
            );
          })()}
          <DataTable
            columns={[
              { key: "country", label: "Country" },
              { key: "shipments", label: t("shipments"), align: "right" },
              { key: "total_cif", label: "CIF (USD)", align: "right", render: (r) => formatMoney(r.total_cif) },
            ]}
            rows={countries}
            emptyText={t("noCountryData")}
            dense
          />
        </ChartCard>

        <ChartCard title={t("importVolumeBySector")} actions={exportBtn('sector_volume.csv', '/export/sector-volume.csv', filters)}>
          {(() => {
            if (loading) return <SkeletonText lines={3} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadSectorData")}</div>;
            if (!sector?.length) return <SkeletonText lines={3} />;
            return (
              <Suspense fallback={<SkeletonText lines={3} />}>
                <div className="dashboard-chart">
                <Bar height={chartH} data={{
                    labels: sector.map(s => s.sector),
                    datasets: [{ label: 'CIF (USD)', data: sector.map(s => s.total_cif), backgroundColor: '#0d6efd' }]
                  }} options={{ maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} />
                </div>
              </Suspense>
            );
          })()}
        </ChartCard>

        <ChartCard title="Top Imported Goods (by CIF)">
          {loading ? null : err && <div className="analytics-error analytics-error-small">{err}</div>}
          {role !== 'Importer' && (
            <ExportActions actions={[
              { label: "Export CSV", onClick: () => downloadCsv('goods.csv', `/export/goods.csv`, { start: filters.start, end: filters.end }) }
            ]} />
          )}
          {(() => {
            if (loading) return <SkeletonText lines={3} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadGoodsData")}</div>;
            if (!goods?.length) return <SkeletonText lines={3} />;
            return (
              <Suspense fallback={<SkeletonText lines={3} />}>
                <div className="dashboard-chart">
                <Bar height={Math.round(chartH * 0.8)} data={{
                    labels: goods.map(g => `${g.hs_code}`),
                    datasets: [{ label: 'CIF (USD)', data: goods.map(g => g.total_cif), backgroundColor: '#16a34a' }]
                  }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </Suspense>
            );
          })()}
          <DataTable
            columns={[
              { key: "hs_code", label: t("hsCode"), render: (r) => r.hs_code || "-" },
              { key: "description", label: t("description"), render: (r) => hsCodes[r.hs_code] || r.description_of_goods || "" },
              { key: "total_cif", label: t("totalCifUsd"), align: "right", render: (r) => formatMoney(r.total_cif) },
              { key: "declarations", label: t("declarations"), align: "right" },
            ]}
            rows={goods}
            emptyText={t("noGoodsData")}
            dense
          />
        </ChartCard>
      </section>

      <section className="analytics-block">
        <div className="dashboard-card dashboard-chart">
          <h4>{t("forecastRevenue")}</h4>
          {(() => {
            if (loading) return <SkeletonText lines={3} />;
            if (err) return <div className="analytics-error">{t("couldNotLoadForecast")}</div>;
            const list = forecast?.forecast || [];
            if (!list.length) return <SkeletonText lines={3} />;
            return (
              <div className="analytics-forecast-list">
                {list.map((f, i) => (
                  <div key={i} className="analytics-forecast-row">
                    <span>{f.period}</span>
                    <span>ETB {formatMoney(f.pred_total)}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      <section className="analytics-block">
        <div className="dashboard-card">
          <h4>{t("operationalRiskQueues")}</h4>
          <div className="dashboard-grid analytics-grid-top">
            <div>
              <div className="analytics-queue-title is-high">
                {t("highRisk")} ({riskQueues.high_risk_queue.length})
              </div>
              <DataTable
                columns={[
                  { key: "declaration_no", label: t("declaration") },
                  { key: "company_name", label: t("importer") },
                  { key: "risk_channel", label: t("risk"), render: (r) => <RiskBadge channel={r.risk_channel} score={r.risk_score} /> },
                  { key: "risk_score", label: t("score"), align: "right" },
                ]}
                rows={riskQueues.high_risk_queue.slice(0, 5)}
                emptyText={t("noHighRiskDecls")}
                dense
              />
            </div>
            <div>
              <div className="analytics-queue-title is-medium">
                {t("mediumRisk")} ({riskQueues.medium_risk_queue.length})
              </div>
              <DataTable
                columns={[
                  { key: "declaration_no", label: t("declaration") },
                  { key: "company_name", label: t("importer") },
                  { key: "risk_channel", label: t("risk"), render: (r) => <RiskBadge channel={r.risk_channel} score={r.risk_score} /> },
                  { key: "risk_score", label: t("score"), align: "right" },
                ]}
                rows={riskQueues.medium_risk_queue.slice(0, 5)}
                emptyText={t("noMediumRiskDecls")}
                dense
              />
            </div>
            <div>
              <div className="analytics-queue-title is-low">
                {t("lowRisk")} ({riskQueues.low_risk_queue.length})
              </div>
              <DataTable
                columns={[
                  { key: "declaration_no", label: t("declaration") },
                  { key: "company_name", label: t("importer") },
                  { key: "risk_channel", label: t("risk"), render: (r) => <RiskBadge channel={r.risk_channel} score={r.risk_score} /> },
                  { key: "risk_score", label: t("score"), align: "right" },
                ]}
                rows={riskQueues.low_risk_queue.slice(0, 5)}
                emptyText={t("noLowRiskDecls")}
                dense
              />
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-block">
        <div className="dashboard-card">
          <h4>{t("riskIntelligenceAdmin")}</h4>
          <div className="dashboard-grid analytics-grid-top">
            <div>
              <div className="analytics-subtitle">{t("highRiskHsCodes")}</div>
              <DataTable
                columns={[
                  { key: "hs_code", label: "HS" },
                  { key: "declarations", label: t("redDecls"), align: "right" },
                  { key: "avg_risk_score", label: t("avgRisk"), align: "right" },
                ]}
                rows={highRiskHs}
                emptyText={t("noHighRiskHsData")}
                dense
              />
            </div>
            <div>
              <div className="analytics-subtitle">{t("topRiskyImporters")}</div>
              <DataTable
                columns={[
                  { key: "company_name", label: t("importer") },
                  { key: "avg_risk_score", label: t("avgRisk"), align: "right" },
                  { key: "red_count", label: t("red"), align: "right" },
                ]}
                rows={topRiskImporters}
                emptyText={t("noRiskyImporterData")}
                dense
              />
            </div>
            <div>
              <div className="analytics-subtitle">{t("countryRiskHeatmapTable")}</div>
              <DataTable
                columns={[
                  { key: "country", label: t("country") },
                  { key: "avg_risk_score", label: t("avgRisk"), align: "right" },
                  { key: "red_count", label: t("red"), align: "right" },
                ]}
                rows={countryRiskHeat.slice(0, 12)}
                emptyText={t("noCountryRiskData")}
                dense
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}






