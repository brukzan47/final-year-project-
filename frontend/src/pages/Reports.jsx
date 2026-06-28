import React, { useMemo, useState } from "react";
import FormField from "../components/FormField.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { ShipmentsAPI } from "../api/shipmentAPI.js";
import { PaymentsAPI } from "../api/paymentAPI.js";
import { InspectionsAPI } from "../api/inspectionAPI.js";
import { ClearancesAPI } from "../api/clearanceAPI.js";
import { PerformanceAPI } from "../api/performanceAPI.js";

export default function Reports() {
  const { t } = useLanguage();
  const [f, set] = useState({
    report_type: "declarations",
    date_from: "",
    date_to: "",
    importer_id: "",
    payment_status: "",
    format: "pdf",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const on = (e) => set({ ...f, [e.target.name]: e.target.value });

  const fetchers = useMemo(
    () => ({
      declarations: DeclarationsAPI.list,
      shipments: ShipmentsAPI.list,
      payments: PaymentsAPI.list,
      inspections: InspectionsAPI.list,
      clearances: ClearancesAPI.list,
      performance: PerformanceAPI.list,
    }),
    []
  );

  const STATUS_OPTIONS = ["Pending", "Failed", "Verified", "Paid"];

  const dateField = {
    declarations: "declaration_date",
    shipments: "arrival_date",
    payments: "payment_date",
    inspections: "inspection_date",
    clearances: "release_date",
    performance: "created_at",
  };

  function toISO(dateStr) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  function withinRange(item, field, from, to) {
    if (!field || (!from && !to)) return true;
    const raw = item?.[field];
    if (!raw) return false;
    const val = toISO(raw) || String(raw).slice(0, 10);
    if (from && val < from) return false;
    if (to && val > to) return false;
    return true;
  }

  function buildCsv(data) {
    if (!data || data.length === 0) return "";
    const cols = Array.from(
      data.reduce((set, row) => {
        Object.keys(row || {}).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/\"/g, '""')}"`;
      }
      return s;
    };
    const head = cols.join(",");
    const body = data
      .map((row) => cols.map((c) => esc(row[c])).join(","))
      .join("\n");
    return head + "\n" + body;
  }

  function download(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCSV(data, baseName) {
    const csv = buildCsv(data);
    download(`${baseName}.csv`, "text/csv;charset=utf-8", csv);
  }

  function exportPDF(data, baseName) {
    const cols = Array.from(
      data.reduce((set, row) => {
        Object.keys(row || {}).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
    const head = cols.map((c) => `<th style="text-align:left;padding:6px;border-bottom:1px solid #ccc">${c}</th>`).join("");
    const body = data
      .map((row) =>
        `<tr>${cols
          .map((c) => `<td style=\"padding:6px;border-bottom:1px solid #f0f0f0\">${row[c] ?? ""}</td>`)
          .join("")}</tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${baseName}</title></head><body>
      <h3>${baseName}</h3>
      <table class="smart-table" style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }

  async function generate() {
    setError("");
    setLoading(true);
    setRows([]);
    try {
      const fetcher = fetchers[f.report_type];
      if (!fetcher) throw new Error(t("unsupportedReportType"));
      const data = await fetcher();
      const from = toISO(f.date_from);
      const to = toISO(f.date_to);
      const dField = dateField[f.report_type];
      let filtered = Array.isArray(data) ? data : [];
      filtered = filtered.filter((item) => withinRange(item, dField, from, to));
      if (f.report_type === "payments" && f.payment_status) {
        filtered = filtered.filter((item) => String(item.payment_status || "").toLowerCase() === f.payment_status.toLowerCase());
      }
      if (f.importer_id && (f.report_type === "shipments" || f.report_type === "performance")) {
        filtered = filtered.filter((item) => String(item.importer_id || "").toLowerCase() === f.importer_id.toLowerCase());
      }

      setRows(filtered);

      const baseName = `${f.report_type}-report`;
      if (f.format === "csv" || f.format === "xlsx") {
        exportCSV(filtered, baseName);
      } else if (f.format === "pdf") {
        exportPDF(filtered, baseName);
      }
    } catch (e) {
      setError(e?.message || t("failedToGenerateReport"));
    } finally {
      setLoading(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    generate();
  };

  const noteImporterUnsupported =
    f.importer_id && !["shipments", "performance"].includes(f.report_type);

  return (
    <div className="reports-page-shell">
      <div className="reports-page-panel">
        <div className="reports-page-section reports-page-section--summary">
          <div className="reports-page-section-head">
            <div>
              <div className="reports-page-kicker">{t("reportsTitle")}</div>
              <h2 className="reports-page-title">{t("reportsTitle")}</h2>
            </div>
          </div>
          <div className="reports-page-summary">
            <div className="reports-summary-item">
              <div className="reports-summary-label">{t("reportType")}</div>
              <div className="reports-summary-value">{t(`${f.report_type}Type`) || f.report_type}</div>
            </div>
            <div className="reports-summary-item">
              <div className="reports-summary-label">{t("dateWindow")}</div>
              <div className="reports-summary-value">{f.date_from || t("any")} - {f.date_to || t("any")}</div>
            </div>
            <div className="reports-summary-item">
              <div className="reports-summary-label">{t("format")}</div>
              <div className="reports-summary-value">{f.format.toUpperCase()}</div>
            </div>
            <div className="reports-summary-item">
              <div className="reports-summary-label">{t("previewRows")}</div>
              <div className="reports-summary-value">{rows.length}</div>
            </div>
          </div>
        </div>

        <div className="reports-page-section reports-page-section--form">
          <div className="reports-page-section-head reports-page-section-head--tight">
            <div>
              <div className="reports-page-kicker">{t("generate")}</div>
              <h3 className="reports-page-subtitle">{t("reportType")}</h3>
            </div>
          </div>
          <form onSubmit={submit} className="adaptive-form reports-page-form">
            <label className="reports-field">
              <span style={{ fontSize: 13 }}>{t("reportType")}</span>
              <select name="report_type" value={f.report_type} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                <option value="declarations">{t("declarationsType")}</option>
                <option value="shipments">{t("shipmentsType")}</option>
                <option value="payments">{t("paymentsType")}</option>
                <option value="inspections">{t("inspectionsType")}</option>
                <option value="clearances">{t("clearancesType")}</option>
                <option value="performance">{t("performanceType")}</option>
              </select>
            </label>
            {f.report_type === "payments" && (
              <label className="reports-field">
                <span style={{ fontSize: 13 }}>{t("paymentStatus")}</span>
                <select name="payment_status" value={f.payment_status} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                  <option value="">{t("all")}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            <FormField label={t("dateFrom")} type="date" name="date_from" value={f.date_from} onChange={on} />
            <FormField label={t("dateTo")} type="date" name="date_to" value={f.date_to} onChange={on} />
            <FormField label={t("importerIdOptional")} name="importer_id" value={f.importer_id} onChange={on} placeholder={t("importerIdPlaceholder")} />
            {noteImporterUnsupported && (
              <div style={{ fontSize: 12, color: "#1e3a8a", background: "rgba(255, 184, 77, 0.12)", border: "1px solid #0d6efd", padding: 8, borderRadius: 6 }}>
                {t("importerFilterNote")}
              </div>
            )}
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t("format")}</span>
              <select name="format" value={f.format} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">{t("excel")}</option>
              </select>
            </label>
            <div>
              <button type="submit" disabled={loading} style={{ width: 160 }}>{loading ? t("generating") : t("generate")}</button>
            </div>
          </form>
        </div>

        {error && (
          <div className="reports-page-error">{error}</div>
        )}

        {rows.length > 0 && (
          <div className="reports-page-section reports-page-section--preview">
            <h4 className="reports-page-subtitle" style={{ margin: 0 }}>{t("preview")} ({rows.length} rows)</h4>
            <div className="reports-page-table-wrap">
              <BasicTable rows={rows} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BasicTable({ rows }) {
  const cols = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
    return Array.from(set);
  }, [rows]);
  return (
    <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            {cols.map((c) => (
              <td key={c} data-label={c} style={{ padding: 8, borderBottom: "1px solid #eff6ff" }}>{String(r?.[c] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}



