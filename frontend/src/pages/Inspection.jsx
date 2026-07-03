import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { InspectionsAPI } from "../api/inspectionAPI.js";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import "../styles/shipmentWizard.css";
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genReleaseRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `REL-${y}${m}${day}-${rand}`;
}

function titleCase(v) {
  const s = String(v || "").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function channelPriority(v) {
  const c = titleCase(v);
  if (c === "Red") return 3;
  if (c === "Yellow") return 2;
  return 1;
}

function isFinalInspectionResult(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "passed" || s === "failed";
}

function completionTone(result, t) {
  return isFinalInspectionResult(result)
    ? { text: t.finished, bg: "#e6ffed", color: "#137333" }
    : { text: t.inProgress, bg: "#fef08a", color: "#3f2a00" };
}

export default function Inspection() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdminRole = role === "Admin" || role === "Super Admin";
  const toast = useToast();

  const [form, setForm] = useState({
    declaration_id: "",
    risk_channel: "Green",
    inspection_date: todayIso(),
    inspector_name: "",
    inspection_result: "",
    remarks: "",
    release_reference: genReleaseRef(),
    release_date: "",
    storage_days: "",
    supervisor_approved: false,
    supervisor_reason: "",
    override_reason: "",
  });

  const [items, setItems] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [declFilter, setDeclFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  const selectedDeclaration = useMemo(
    () => declarations.find((d) => String(d.declaration_id) === String(form.declaration_id)) || null,
    [declarations, form.declaration_id]
  );

  const assignedChannel = titleCase(selectedDeclaration?.risk_channel || "Green") || "Green";
  const assignedScore = Number(selectedDeclaration?.risk_score || 0);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      risk_channel: prev.declaration_id ? titleCase(selectedDeclaration?.risk_channel || prev.risk_channel || "Green") : prev.risk_channel,
    }));
  }, [selectedDeclaration?.declaration_id, selectedDeclaration?.risk_channel]);

  const isDowngrade = channelPriority(form.risk_channel) < channelPriority(assignedChannel);
  const isRedDowngrade = assignedChannel === "Red" && titleCase(form.risk_channel) !== "Red";

  const load = async () => {
    try {
      const [insps, decls] = await Promise.all([
        InspectionsAPI.list(),
        DeclarationsAPI.list(),
      ]);
      setItems(Array.isArray(insps) ? insps : []);
      setDeclarations(Array.isArray(decls) ? decls : []);
    } catch (e) {
      toast?.error?.(e.message || t.failedLoadInspections);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const d = p.get("declaration_id") || "";
      if (d) {
        setDeclFilter(d);
        setForm((prev) => ({ ...prev, declaration_id: d }));
      }
    } catch {}
  }, [location.search]);

  const filteredItems = useMemo(() => {
    const q = String(declFilter || "").trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((i) =>
      String(i.declaration_id || "").toLowerCase() === q ||
      String(i.declaration_no || "").toLowerCase().includes(q)
    );
  }, [items, declFilter]);

  const finalizedInspectedIds = useMemo(
    () => new Set((items || []).filter((x) => isFinalInspectionResult(x.inspection_result)).map((x) => String(x.declaration_id))),
    [items]
  );

  const selectableDeclarations = useMemo(
    () => (declarations || []).filter((d) => !finalizedInspectedIds.has(String(d.declaration_id))),
    [declarations, finalizedInspectedIds]
  );

  const onField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.declaration_id) {
      setError(t.selectDeclarationErr);
      return;
    }
    if (isDowngrade && !String(form.override_reason || "").trim()) {
      setError(t.overrideReasonRequired);
      return;
    }
    if (isRedDowngrade && (!form.supervisor_approved || !String(form.supervisor_reason || "").trim())) {
      setError(t.supervisorApprovalRequired);
      return;
    }
    if (isRedDowngrade && !isAdminRole) {
      setError(t.onlyAdminDowngrade);
      return;
    }

    setLoading(true);
    try {
      await InspectionsAPI.create({
        ...form,
        risk_channel: titleCase(form.risk_channel),
        supervisor_approved: !!form.supervisor_approved,
      });
      toast?.success?.(t.inspectionSubmitted);
      setForm({
        declaration_id: "",
        risk_channel: "Green",
        inspection_date: todayIso(),
        inspector_name: "",
        inspection_result: "",
        remarks: "",
        release_reference: genReleaseRef(),
        release_date: "",
        storage_days: "",
        supervisor_approved: false,
        supervisor_reason: "",
        override_reason: "",
      });
      await load();
    } catch (e) {
      setError(e.message || t.failedSaveInspection);
      toast?.error?.(e.message || t.failedSaveInspection);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inspections-page-shell">
      <div className="inspections-page-panel">
        <div className="inspections-page-section inspections-page-section--head">
          <div className="inspections-page-section-head">
            <div>
              <div className="inspections-page-kicker">{t.inspectionDesk}</div>
              <h2 className="inspections-page-title">{t.inspectionDesk}</h2>
              <div className="inspections-page-subtitle">{t.subtitle}</div>
            </div>
          </div>
        </div>

        <div className="inspections-page-section inspections-page-section--form">
          <div className="inspections-page-section-head inspections-page-section-head--tight">
            <div>
              <div className="inspections-page-kicker">{t.newInspectionRecord}</div>
              <h3 className="inspections-page-subtitle">{t.newInspectionRecord}</h3>
            </div>
            <div className="inspections-page-section-actions">
              <button type="button" className="eu-btn" onClick={() => navigate("/declarations")}>{t.createDeclaration}</button>
              <button type="submit" form="inspection-submit-form" className="eu-btn primary" disabled={loading}>
                {loading ? t.saving : t.submitInspection}
              </button>
            </div>
          </div>
          <form id="inspection-submit-form" className="eu-card inspections-page-card" onSubmit={submit}>
            <p className="eu-help">{t.helpText}</p>

            <div className="eu-grid two">
              <label className="eu-field">
                <span>{t.declaration}</span>
                <select value={form.declaration_id} onChange={(e) => onField("declaration_id", e.target.value)}>
                  <option value="">{t.selectDeclaration}</option>
                  {selectableDeclarations.map((d) => (
                    <option key={d.declaration_id} value={d.declaration_id}>{d.declaration_no}</option>
                  ))}
                </select>
              </label>

              <label className="eu-field">
                <span>{t.assignedRisk}</span>
                <div style={{ paddingTop: 8 }}>
                  <RiskBadge channel={assignedChannel} score={assignedScore} />
                </div>
              </label>

              <label className="eu-field">
                <span>{t.inspectionRiskChannel}</span>
                <select value={form.risk_channel} onChange={(e) => onField("risk_channel", e.target.value)}>
                  <option value="Green">Green</option>
                  <option value="Yellow">Yellow</option>
                  <option value="Red">Red</option>
                </select>
              </label>

              <label className="eu-field">
                <span>{t.inspectionDate}</span>
                <input type="date" value={form.inspection_date} onChange={(e) => onField("inspection_date", e.target.value)} />
              </label>

              <label className="eu-field">
                <span>{t.inspectorName}</span>
                <input value={form.inspector_name} onChange={(e) => onField("inspector_name", e.target.value)} placeholder={t.inspectorPlaceholder} />
              </label>

              <label className="eu-field">
                <span>{t.inspectionResult}</span>
                <select value={form.inspection_result} onChange={(e) => onField("inspection_result", e.target.value)}>
                  <option value="">{t.selectResult}</option>
                  <option value="Passed">{t.passed}</option>
                  <option value="Failed">{t.failed}</option>
                </select>
              </label>

              <label className="eu-field">
                <span>{t.storageDays}</span>
                <input type="number" step="0.01" value={form.storage_days} onChange={(e) => onField("storage_days", e.target.value)} placeholder="2" />
              </label>

              <label className="eu-field">
                <span>{t.releaseReference}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input value={form.release_reference} onChange={(e) => onField("release_reference", e.target.value)} placeholder="REL-YYYYMMDD-XXXX" />
                  <button type="button" className="eu-btn" onClick={() => onField("release_reference", genReleaseRef())}>{t.auto}</button>
                </div>
              </label>

              <label className="eu-field">
                <span>{t.releaseDate}</span>
                <input type="date" value={form.release_date} onChange={(e) => onField("release_date", e.target.value)} />
              </label>
            </div>

            {isDowngrade && (
              <label className="eu-field" style={{ marginTop: 10 }}>
                <span>{t.overrideReasonRequiredLabel}</span>
                <input value={form.override_reason} onChange={(e) => onField("override_reason", e.target.value)} placeholder={t.overrideReasonPh} />
              </label>
            )}

            {isRedDowngrade && (
              <div style={{ border: "1px solid #f0b4b4", background: "#fff6f6", padding: 10, borderRadius: 8, marginTop: 10 }}>
                {!isAdminRole && (
                  <div style={{ color: "#b42318", fontSize: 12, marginBottom: 8 }}>
                    {t.onlyAdminRed}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={!!form.supervisor_approved}
                    onChange={(e) => onField("supervisor_approved", e.target.checked)}
                    disabled={!isAdminRole}
                  />
                  {t.supervisorApprovedRed}
                </label>
                <label className="eu-field" style={{ marginTop: 8 }}>
                  <span>{t.supervisorReason}</span>
                  <input
                    value={form.supervisor_reason}
                    onChange={(e) => onField("supervisor_reason", e.target.value)}
                    placeholder={t.supervisorReasonPh}
                    disabled={!isAdminRole}
                  />
                </label>
              </div>
            )}

            <label className="eu-field" style={{ marginTop: 10 }}>
              <span>{t.remarks}</span>
              <input value={form.remarks} onChange={(e) => onField("remarks", e.target.value)} placeholder={t.remarksPh} />
            </label>

            <div className="eu-preview">
              <div>{t.decisionSnapshot}</div>
              <div>{t.declaration}: {selectedDeclaration?.declaration_no || "-"}</div>
              <div>{t.assigned}: <RiskBadge channel={assignedChannel} score={assignedScore} /></div>
              <div>{t.selected}: <RiskBadge channel={form.risk_channel || "Green"} score={assignedScore} /></div>
              <div>{t.releaseReference}: {form.release_reference || "-"}</div>
            </div>

            <div className="eu-nav inspections-page-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="eu-btn" onClick={() => navigate("/declarations")}>{t.createDeclaration}</button>
              <button type="submit" className="eu-btn primary" disabled={loading}>{loading ? t.saving : t.submitInspection}</button>
            </div>

            {error && <div className="err">{error}</div>}
          </form>
        </div>

        <div className="inspections-page-section inspections-page-section--registry">
          <div className="inspections-page-section-head inspections-page-section-head--tight">
            <div>
              <div className="inspections-page-kicker">{t.inspectionRegistry}</div>
              <h3 className="inspections-page-subtitle">{t.inspectionRegistry}</h3>
            </div>
          </div>
          <div className="inspections-page-filter-row">
            <input
              value={declFilter}
              onChange={(e) => setDeclFilter(e.target.value)}
              placeholder={t.filterByDeclarationId}
              className="inspections-page-filter"
            />
            {!!declFilter && (
              <button type="button" className="eu-btn" onClick={() => { setDeclFilter(""); navigate({ search: "" }); }}>
                {t.clear}
              </button>
            )}
          </div>

          <div className="inspections-page-table-wrap">
            <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.declaration}</th>
                  <th>{t.date}</th>
                  <th>{t.inspector}</th>
                  <th>{t.result}</th>
                  <th>{t.completion}</th>
                  <th>{t.risk}</th>
                  <th>{t.details}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i) => (
                  (() => {
                    const completion = completionTone(i.inspection_result, t);
                    return (
                  <tr key={i.inspection_id}>
                    <td>{i.declaration_no || "-"}</td>
                    <td>{i.inspection_date || "-"}</td>
                    <td>{i.inspector_name || "-"}</td>
                    <td>
                      <StatusBadge status={i.inspection_result || "Pending"} />
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          background: completion.bg,
                          color: completion.color,
                        }}
                      >
                        {completion.text}
                      </span>
                    </td>
                    <td>
                      <RiskBadge channel={i.risk_channel || i.assigned_risk_channel || "Green"} score={typeof i.risk_score === "number" ? i.risk_score : Number(i.assigned_risk_score || 0)} />
                    </td>
                    <td>
                      <button type="button" className="eu-btn" onClick={() => setExpanded((prev) => ({ ...prev, [i.inspection_id]: !prev[i.inspection_id] }))}>
                        {expanded[i.inspection_id] ? t.hide : t.show}
                      </button>
                      {expanded[i.inspection_id] && (
                        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                          {(i.risk_reasons && i.risk_reasons.length > 0) ? (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {i.risk_reasons.map((r, idx) => <li key={idx}>{r}</li>)}
                            </ul>
                          ) : (
                            <span>{t.noRiskReasons}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                    );
                  })()
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="7">{t.noInspectionRecords}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const EN = {
  failedLoadInspections: "Failed to load inspections",
  selectDeclarationErr: "Please select a declaration.",
  overrideReasonRequired: "Override reason is required when lowering assigned risk channel.",
  supervisorApprovalRequired: "Supervisor approval and reason are required to downgrade Red.",
  onlyAdminDowngrade: "Only Admin can submit downgrade from assigned Red channel.",
  inspectionSubmitted: "Inspection record submitted.",
  failedSaveInspection: "Failed to save inspection",
  inspectionDesk: "Inspection Desk",
  subtitle: "AI-based risk workflow with secure override controls",
  newInspectionRecord: "New Inspection Record",
  helpText: "System assigns risk automatically. Officers can upgrade risk; Red downgrade requires supervisor approval.",
  declaration: "Declaration",
  selectDeclaration: "Select declaration...",
  assignedRisk: "Assigned Risk",
  inspectionRiskChannel: "Inspection Risk Channel",
  inspectionDate: "Inspection Date",
  inspectorName: "Inspector Name",
  inspectorPlaceholder: "Officer Tesfaye",
  inspectionResult: "Inspection Result",
  selectResult: "Select result...",
  passed: "Passed",
  failed: "Failed",
  storageDays: "Storage Days",
  releaseReference: "Release Reference",
  auto: "Auto",
  releaseDate: "Release Date",
  overrideReasonRequiredLabel: "Override Reason (Required)",
  overrideReasonPh: "Why channel is reduced from assigned value",
  onlyAdminRed: "Only Admin can approve and submit Red-channel downgrade.",
  supervisorApprovedRed: "Supervisor approved downgrade from Red",
  supervisorReason: "Supervisor Reason",
  supervisorReasonPh: "Supervisor justification",
  remarks: "Remarks",
  remarksPh: "Additional inspection notes",
  decisionSnapshot: "Decision Snapshot",
  assigned: "Assigned",
  selected: "Selected",
  createDeclaration: "Create Declaration",
  saving: "Saving...",
  saveInspection: "Save Inspection",
  submitInspection: "Submit Inspection",
  inspectionRegistry: "Inspection Registry",
  filterByDeclarationId: "Filter by declaration_id",
  clear: "Clear",
  date: "Date",
  inspector: "Inspector",
  result: "Result",
  completion: "Completion",
  risk: "Risk",
  details: "Details",
  hide: "Hide",
  show: "Show",
  finished: "Finished",
  inProgress: "In Progress",
  noRiskReasons: "No risk reasons provided.",
  noInspectionRecords: "No inspection records found.",
};

const AM = {
  failedLoadInspections: "á‹¨áˆáˆ­áˆ˜áˆ« áˆ˜áˆ¨áŒƒ áˆ˜áŒ«áŠ• áŠ áˆá‰°áˆ³áŠ«áˆ",
  selectDeclarationErr: "áŠ¥á‰£áŠ­á‹Ž áˆ˜áŒáˆˆáŒ« á‹­áˆáˆ¨áŒ¡á¢",
  overrideReasonRequired: "á‹¨á‰°áˆ˜á‹°á‰ á‹áŠ• á‹¨áŠ á‹°áŒ‹ á‹°áˆ¨áŒƒ áˆ²á‰€áŠ•áˆ± á‹¨Override áˆáŠ­áŠ•á‹«á‰µ áŠ áˆµáˆáˆ‹áŒŠ áŠá‹á¢",
  supervisorApprovalRequired: "á‰€á‹­ á‹°áˆ¨áŒƒáŠ• áˆˆáˆ˜á‰€áŠáˆµ á‹¨áŠƒáˆ‹áŠ áá‰ƒá‹µ áŠ¥áŠ“ áˆáŠ­áŠ•á‹«á‰µ á‹«áˆµáˆáˆáŒ‹áˆá¢",
  onlyAdminDowngrade: "áŠ¨á‰°áˆ˜á‹°á‰  á‰€á‹­ á‹°áˆ¨áŒƒ á‹ˆá‹°á‰³á‰½ áˆ›áˆµáŒˆá‰£á‰µ á‹¨áˆšá‰½áˆˆá‹ Admin á‰¥á‰» áŠá‹á¢",
  inspectionSubmitted: "á‹¨áˆáˆ­áˆ˜áˆ« áˆ˜á‹áŒˆá‰¥ á‰°áˆáŠ³áˆá¢",
  failedSaveInspection: "áˆáˆ­áˆ˜áˆ« áˆ›áˆµá‰€áˆ˜áŒ¥ áŠ áˆá‰°áˆ³áŠ«áˆ",
  inspectionDesk: "á‹¨áˆáˆ­áˆ˜áˆ« á‹´áˆµáŠ­",
  subtitle: "á‰ AI á‹¨á‰°áˆ˜áˆ°áˆ¨á‰° á‹¨áŠ á‹°áŒ‹ áˆ‚á‹°á‰µ áŠ¨á‹°áˆ…áŠ•áŠá‰µ á‰áŒ¥áŒ¥áˆ­ áŒ‹áˆ­",
  newInspectionRecord: "áŠ á‹²áˆµ á‹¨áˆáˆ­áˆ˜áˆ« áˆ˜á‹áŒˆá‰¥",
  helpText: "áˆµáˆ­á‹“á‰± áŠ á‹°áŒ‹áŠ• á‰ áˆ«áˆµ-áˆ°áˆ­ á‹­áˆ˜á‹µá‰£áˆá¢ áˆ˜áŠ®áŠ•áŠ–á‰½ áˆŠá‹«áˆ³á‹µáŒ‰ á‹­á‰½áˆ‹áˆ‰á¤ á‰€á‹­ áˆˆáˆ˜á‰€áŠáˆµ á‹¨áŠƒáˆ‹áŠ áá‰ƒá‹µ á‹«áˆµáˆáˆáŒ‹áˆá¢",
  declaration: "áˆ˜áŒáˆˆáŒ«",
  selectDeclaration: "áˆ˜áŒáˆˆáŒ« á‹­áˆáˆ¨áŒ¡...",
  assignedRisk: "á‹¨á‰°áˆ˜á‹°á‰  áŠ á‹°áŒ‹",
  inspectionRiskChannel: "á‹¨áˆáˆ­áˆ˜áˆ« á‹¨áŠ á‹°áŒ‹ á‰»áŠ“áˆ",
  inspectionDate: "á‹¨áˆáˆ­áˆ˜áˆ« á‰€áŠ•",
  inspectorName: "á‹¨áˆ˜áˆ­áˆ›áˆª áˆµáˆ",
  inspectorPlaceholder: "áˆ˜áŠ®áŠ•áŠ• á‰°áˆµá‹á‹¬",
  inspectionResult: "á‹¨áˆáˆ­áˆ˜áˆ« á‹áŒ¤á‰µ",
  selectResult: "á‹áŒ¤á‰µ á‹­áˆáˆ¨áŒ¡...",
  passed: "áŠ áˆˆáˆ",
  failed: "áŠ áˆáˆáˆˆáŒˆáˆ",
  storageDays: "á‹¨áˆ›áŠ¨áˆ›á‰» á‰€áŠ“á‰µ",
  releaseReference: "á‹¨áˆ˜áˆá‰€á‰‚á‹« áˆ›áŒ£á‰€áˆ»",
  auto: "áŠ á‹á‰¶",
  releaseDate: "á‹¨áˆ˜áˆá‰€á‰‚á‹« á‰€áŠ•",
  overrideReasonRequiredLabel: "á‹¨Override áˆáŠ­áŠ•á‹«á‰µ (áŠ áˆµáˆáˆ‹áŒŠ)",
  overrideReasonPh: "áŠ¨á‰°áˆ˜á‹°á‰ á‹ á‹°áˆ¨áŒƒ áˆˆáˆáŠ• á‰°á‰€áŠ•áˆ·áˆ",
  onlyAdminRed: "á‰€á‹­ á‹°áˆ¨áŒƒ áŠ¥áŠ•á‹²á‰€áŠ•áˆµ áá‰ƒá‹µ áŠ¥áŠ“ áˆ›áˆµáŒˆá‰£á‰µ á‹¨áˆšá‰½áˆˆá‹ Admin á‰¥á‰» áŠá‹á¢",
  supervisorApprovedRed: "áŠ¨á‰€á‹­ á‹¨áˆšá‰€áŠáˆµ á‹áˆ³áŠ” á‰ áŠƒáˆ‹áŠ á‰°áˆá‰…á‹·áˆ",
  supervisorReason: "á‹¨áŠƒáˆ‹áŠ áˆáŠ­áŠ•á‹«á‰µ",
  supervisorReasonPh: "á‹¨áŠƒáˆ‹áŠ áˆ›á‰¥áˆ«áˆªá‹«",
  remarks: "áˆ›áˆµá‰³á‹ˆáˆ»",
  remarksPh: "á‰°áŒ¨áˆ›áˆª á‹¨áˆáˆ­áˆ˜áˆ« áˆ›áˆµá‰³á‹ˆáˆ»",
  decisionSnapshot: "á‹¨á‹áˆ³áŠ” áŠ áŒ­áˆ­ áˆ›áŒ á‰ƒáˆˆá‹«",
  assigned: "á‹¨á‰°áˆ˜á‹°á‰ ",
  selected: "á‹¨á‰°áˆ˜áˆ¨áŒ ",
  createDeclaration: "áˆ˜áŒáˆˆáŒ« ááŒ áˆ­",
  saving: "á‰ áˆ›áˆµá‰€áˆ˜áŒ¥ áˆ‹á‹­...",
  saveInspection: "áˆáˆ­áˆ˜áˆ« áŠ áˆµá‰€áˆáŒ¥",
  submitInspection: "áˆáˆ­áˆ˜áˆ« áˆáŠ­",
  inspectionRegistry: "á‹¨áˆáˆ­áˆ˜áˆ« áˆ˜á‹áŒˆá‰¥",
  filterByDeclarationId: "á‰ declaration_id áŠ áŒ£áˆ«",
  clear: "áŠ áŒ¥á‹",
  date: "á‰€áŠ•",
  inspector: "áˆ˜áˆ­áˆ›áˆª",
  result: "á‹áŒ¤á‰µ",
  completion: "áŠ áŒ áŠ“á‰€á‰€",
  risk: "áŠ á‹°áŒ‹",
  details: "á‹áˆ­á‹áˆ­",
  hide: "á‹°á‰¥á‰…",
  show: "áŠ áˆ³á‹­",
  finished: "á‰°áŒ áŠ“á‰…á‰‹áˆ",
  inProgress: "á‰ áˆ‚á‹°á‰µ áˆ‹á‹­",
  noRiskReasons: "á‹¨áŠ á‹°áŒ‹ áˆáŠ­áŠ•á‹«á‰¶á‰½ áŠ áˆá‰€áˆ¨á‰¡áˆá¢",
  noInspectionRecords: "á‹¨áˆáˆ­áˆ˜áˆ« áˆ˜á‹áŒˆá‰¥ áŠ áˆá‰°áŒˆáŠ˜áˆá¢",
};







