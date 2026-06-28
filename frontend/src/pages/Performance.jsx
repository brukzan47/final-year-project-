import React, { useEffect, useState } from "react";
import FormField from "../components/FormField.jsx";
import { PerformanceAPI } from "../api/performanceAPI.js";
import { ImportersAPI } from "../api/importerAPI.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Performance() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const [f, set] = useState({
    importer_id: "",
    avg_clearance_time: "",
    number_of_queries: "",
    penalties: "",
    complaints: "",
    feedback_score: "",
    officer_responsible: "",
    notes: "",
  });
  const on = (e) => set({ ...f, [e.target.name]: e.target.value });
  const [items, setItems] = useState([]);
  const [importers, setImporters] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => { try {
    setErr("");
    const [perfs, imps] = await Promise.all([
      PerformanceAPI.list(),
      ImportersAPI.list(),
    ]);
    setItems(perfs || []);
    setImporters(imps || []);
  } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (!f.importer_id) { setErr(t.selectImporterErr); return; }
    setLoading(true);
    try {
      await PerformanceAPI.create(f);
      set({ importer_id: "", avg_clearance_time: "", number_of_queries: "", penalties: "", complaints: "", feedback_score: "", officer_responsible: "", notes: "" });
      await load();
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  const avgClearance = items.length
    ? (items.reduce((sum, x) => sum + Number(x.avg_clearance_time || 0), 0) / items.length).toFixed(1)
    : "0.0";
  const avgFeedback = items.length
    ? (items.reduce((sum, x) => sum + Number(x.feedback_score || 0), 0) / items.length).toFixed(1)
    : "0.0";

  return (
    <div className="performance-page-shell">
      <div className="performance-page-panel">
        <div className="performance-page-section performance-page-section--summary">
          <div className="performance-page-section-head">
            <div>
              <div className="performance-page-kicker">{t.title}</div>
              <h2 className="performance-page-title">{t.title}</h2>
            </div>
          </div>
          <div className="performance-page-summary">
            <div className="performance-page-summary-item">
              <div className="performance-page-summary-label">{t.records}</div>
              <div className="performance-page-summary-value">{items.length}</div>
            </div>
            <div className="performance-page-summary-item">
              <div className="performance-page-summary-label">{t.avgClearance}</div>
              <div className="performance-page-summary-value">{avgClearance} {t.days}</div>
            </div>
            <div className="performance-page-summary-item">
              <div className="performance-page-summary-label">{t.avgFeedback}</div>
              <div className="performance-page-summary-value">{avgFeedback}</div>
            </div>
          </div>
        </div>

        <div className="performance-page-section performance-page-section--form">
          <div className="performance-page-section-head performance-page-section-head--tight">
            <div>
              <div className="performance-page-kicker">{t.savePerformance}</div>
              <h3 className="performance-page-subtitle">{t.performanceRecords}</h3>
            </div>
          </div>
          <form onSubmit={submit} className="performance-page-form">
            <label className="reports-field">
              <span style={{ fontSize: 13 }}>{t.importer}</span>
              <select name="importer_id" value={f.importer_id} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                <option value="">{t.selectImporter}</option>
                {importers.map((imp) => (
                  <option key={imp.importer_id} value={imp.importer_id}>{imp.company_name}</option>
                ))}
              </select>
            </label>
            <FormField label={t.avgClearanceDays} type="number" step="0.01" name="avg_clearance_time" value={f.avg_clearance_time} onChange={on} placeholder="3.5" />
            <FormField label={t.numQueries} type="number" name="number_of_queries" value={f.number_of_queries} onChange={on} placeholder="2" />
            <FormField label={t.penalties} name="penalties" value={f.penalties} onChange={on} placeholder={t.none} />
            <FormField label={t.complaints} name="complaints" value={f.complaints} onChange={on} placeholder={t.delayedRelease} />
            <FormField label={t.feedbackScore} type="number" step="0.1" name="feedback_score" value={f.feedback_score} onChange={on} placeholder="4.2" />
            <FormField label={t.officerResponsible} name="officer_responsible" value={f.officer_responsible} onChange={on} placeholder={t.officerPlaceholder} />
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.notes}</span>
              <textarea name="notes" value={f.notes} onChange={on} placeholder={t.notesPh} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }} />
            </label>
            {err && <div style={{ color: '#b00020' }}>{err}</div>}
            <div><button type="submit" disabled={loading} style={{ width: 210 }}>{loading? t.saving : t.savePerformance}</button></div>
          </form>
        </div>

        <div className="performance-page-section performance-page-section--table">
          <h3 className="performance-page-subtitle" style={{ margin: 0 }}>{t.performanceRecords}</h3>
          <div className="performance-page-table-wrap">
            <table className="smart-table smart-table--stack" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.importer}</th><th>{t.avgTime}</th><th>{t.queries}</th><th>{t.feedback}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.performance_id}>
                    <td data-label="Importer">{i.company_name}</td>
                    <td data-label="Avg Time">{i.avg_clearance_time}</td>
                    <td data-label="Queries">{i.number_of_queries}</td>
                    <td data-label="Feedback">{i.feedback_score}</td>
                  </tr>
                ))}
                {items.length === 0 && (<tr><td colSpan="4">{t.noRecords}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const EN = {
  title: "Performance",
  records: "Records",
  avgClearance: "Avg Clearance",
  days: "days",
  avgFeedback: "Avg Feedback",
  importer: "Importer",
  selectImporter: "Select importer...",
  avgClearanceDays: "Avg. Clearance Time (days)",
  numQueries: "Number of Queries",
  penalties: "Penalties",
  none: "None",
  complaints: "Complaints",
  delayedRelease: "Delayed release",
  feedbackScore: "Feedback Score",
  officerResponsible: "Officer Responsible",
  officerPlaceholder: "Officer Hana",
  notes: "Notes",
  notesPh: "Additional KPIs or remarks",
  saving: "Saving...",
  savePerformance: "Save Performance",
  performanceRecords: "Performance Records",
  avgTime: "Avg Time",
  queries: "Queries",
  feedback: "Feedback",
  noRecords: "No records",
  selectImporterErr: "Please select an importer",
};

const AM = {
  title: "áŠ áˆáŒ»áŒ¸áˆ",
  records: "áˆ˜á‹áŒˆá‰¦á‰½",
  avgClearance: "áŠ áˆ›áŠ«á‹­ áˆ›áŒ½á‹³á‰µ",
  days: "á‰€áŠ“á‰µ",
  avgFeedback: "áŠ áˆ›áŠ«á‹­ áŒá‰¥áˆ¨áˆ˜áˆáˆµ",
  importer: "áŠ áˆµáˆ˜áŒª",
  selectImporter: "áŠ áˆµáˆ˜áŒª á‹­áˆáˆ¨áŒ¡...",
  avgClearanceDays: "áŠ áˆ›áŠ«á‹­ á‹¨áˆ›áŒ½á‹³á‰µ áŒŠá‹œ (á‰€áŠ“á‰µ)",
  numQueries: "á‹¨áŒ¥á‹«á‰„á‹Žá‰½ á‰¥á‹›á‰µ",
  penalties: "á‰…áŒ£á‰¶á‰½",
  none: "á‹¨áˆˆáˆ",
  complaints: "á‰…áˆ¬á‰³á‹Žá‰½",
  delayedRelease: "á‹¨á‰°á‹˜áŒˆá‹¨ áˆ˜áˆá‰€á‰…",
  feedbackScore: "á‹¨áŒá‰¥áˆ¨áˆ˜áˆáˆµ áŠáŒ¥á‰¥",
  officerResponsible: "áŠƒáˆ‹áŠ áˆ˜áŠ®áŠ•áŠ•",
  officerPlaceholder: "áˆ˜áŠ®áŠ•áŠ• áˆáŠ“",
  notes: "áˆ›áˆµá‰³á‹ˆáˆ»",
  notesPh: "á‰°áŒ¨áˆ›áˆª KPI á‹ˆá‹­áˆ áˆ›áˆµá‰³á‹ˆáˆ»",
  saving: "á‰ áˆ›áˆµá‰€áˆ˜áŒ¥ áˆ‹á‹­...",
  savePerformance: "áŠ áˆáŒ»áŒ¸áˆ áŠ áˆµá‰€áˆáŒ¥",
  performanceRecords: "á‹¨áŠ áˆáŒ»áŒ¸áˆ áˆ˜á‹áŒˆá‰¦á‰½",
  avgTime: "áŠ áˆ›áŠ«á‹­ áŒŠá‹œ",
  queries: "áŒ¥á‹«á‰„á‹Žá‰½",
  feedback: "áŒá‰¥áˆ¨áˆ˜áˆáˆµ",
  noRecords: "áˆ˜á‹áŒˆá‰¥ á‹¨áˆˆáˆ",
  selectImporterErr: "áŠ¥á‰£áŠ­á‹Ž áŠ áˆµáˆ˜áŒª á‹­áˆáˆ¨áŒ¡",
};


