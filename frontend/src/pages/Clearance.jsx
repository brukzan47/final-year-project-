import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClearancesAPI } from "../api/clearanceAPI.js";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Modal from "../components/Modal.jsx";
import "../styles/shipmentWizard.css";
const CUSTOMS_OFFICE_OPTIONS = [
  "Kality",
  "Bole",
  "Modjo",
  "Dire Dawa",
  "Moyale",
  "Metema",
  "Galafi",
  "Djibouti Corridor",
];
const DESTINATION_ADDRESS_OPTIONS = [
  "Megenagna Warehouse #4, Addis Ababa",
  "Kaliti Industrial Zone, Addis Ababa",
  "Bole Logistics Center, Addis Ababa",
  "Adama Distribution Hub, Adama",
  "Dire Dawa Transit Yard, Dire Dawa",
  "Hawassa Industrial Park, Hawassa",
];
const OTHER_VALUE = "__OTHER__";
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readinessBadge(item, tx) {
  if (!item) return { text: tx.unknown, bg: "rgba(125, 166, 217, 0.14)", fg: "#cfe1fb" };
  if (item.ready_for_clearance) return { text: tx.ready, bg: "#e6ffed", fg: "#137333" };
  if (item.already_cleared) return { text: tx.cleared, bg: "rgba(111, 123, 255, 0.18)", fg: "#dfe2ff" };
  return { text: tx.blocked, bg: "#fef08a", fg: "#3f2a00" };
}

function fmtDate(v) {
  if (!v) return "-";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
}

export default function Clearance() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { lang } = useLanguage();
  const tx = lang === "am" ? AM : EN;

  const [form, setForm] = useState({
    declaration_id: "",
    release_date: todayIso(),
    officer_name: "",
    customs_office: "",
    delivery_note_no: "",
    transport_company: "",
    truck_plate_no: "",
    destination_address: "",
  });

  const [items, setItems] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [declFilter, setDeclFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const readinessByDeclarationId = useMemo(() => {
    const map = new Map();
    for (const r of readiness) map.set(String(r.declaration_id), r);
    return map;
  }, [readiness]);

  const selectedDeclaration = useMemo(
    () => declarations.find((d) => String(d.declaration_id) === String(form.declaration_id)) || null,
    [declarations, form.declaration_id]
  );

  const selectedReadiness = useMemo(
    () => readinessByDeclarationId.get(String(form.declaration_id)) || null,
    [readinessByDeclarationId, form.declaration_id]
  );

  const load = async () => {
    try {
      const [clrs, decls, ready] = await Promise.all([
        ClearancesAPI.list(),
        DeclarationsAPI.list(),
        ClearancesAPI.readiness(),
      ]);
      setItems(Array.isArray(clrs) ? clrs : []);
      setDeclarations(Array.isArray(decls) ? decls : []);
      setReadiness([...(ready?.ready || []), ...(ready?.blocked || [])]);
    } catch (e) {
      toast?.error?.(e.message || tx.failedLoad);
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

  const readyQueue = useMemo(() => readiness.filter((x) => x.ready_for_clearance), [readiness]);

  const filteredItems = useMemo(() => {
    if (!declFilter) return items;
    return items.filter((i) => String(i.declaration_id) === String(declFilter));
  }, [items, declFilter]);

  const onField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.declaration_id) {
      setError(tx.selectDeclaration);
      return;
    }

    const check = readinessByDeclarationId.get(String(form.declaration_id));
    if (check && !check.ready_for_clearance) {
      setError(`${tx.declarationNotReady}: ${(check.blockers || []).join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      await ClearancesAPI.create(form);
      toast?.success?.(tx.recordSubmitted);
      setForm({
        declaration_id: "",
        release_date: todayIso(),
        officer_name: "",
        customs_office: "",
        delivery_note_no: "",
        transport_company: "",
        truck_plate_no: "",
        destination_address: "",
      });
      await load();
    } catch (e) {
      setError(e.message || tx.failedSave);
      toast?.error?.(e.message || tx.failedSave);
    } finally {
      setLoading(false);
    }
  };

  const downloadReleaseNote = async (row) => {
    try {
      setDownloadingId(String(row.clearance_id));
      const { blob, contentType } = await ClearancesAPI.downloadReleaseNote(row.clearance_id);
      const ext = contentType.includes("pdf") ? "pdf" : "txt";
      const filename = `release-note-${row.delivery_note_no || row.clearance_id}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast?.success?.(tx.releaseDownloaded);
    } catch (e) {
      toast?.error?.(e.message || tx.releaseDownloadFailed);
    } finally {
      setDownloadingId("");
    }
  };

  const openDetails = async (row) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailData(null);
      const full = await ClearancesAPI.getById(row.clearance_id);
      setDetailData(full || null);
    } catch (e) {
      toast?.error?.(e.message || tx.detailFailed);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const badge = readinessBadge(selectedReadiness, tx);

  return (
    <div className="clearance-page-shell">
      <div className="clearance-page-panel">
        <div className="clearance-page-section">
          <div className="clearance-page-section-head">
            <div>
              <div className="clearance-page-kicker">Operations</div>
              <h2 className="clearance-page-title">{tx.clearanceControl}</h2>
              <div className="clearance-page-subtitle">{tx.finalRelease}</div>
            </div>
          </div>
        </div>

        <div className="clearance-page-section">
          <div className="clearance-page-section-head clearance-page-section-head--tight">
            <h3 className="clearance-page-subtitle">{tx.readyQueue}</h3>
          </div>
          <div className="clearance-page-queue">
            {readyQueue.slice(0, 8).map((r) => (
              <button
                key={r.declaration_id}
                type="button"
                className="eu-btn clearance-page-queue-item"
                onClick={() => onField("declaration_id", r.declaration_id)}
              >
                <span>{r.declaration_no} - {r.company_name}</span>
                <span className="clearance-page-queue-badge">{tx.ready}</span>
              </button>
            ))}
            {readyQueue.length === 0 && <span className="clearance-page-empty">{tx.noneReady}</span>}
          </div>
        </div>

        <form id="clearance-submit-form" className="clearance-page-section clearance-page-card" onSubmit={submit}>
          <div className="clearance-page-section-head clearance-page-section-head--tight">
            <h3 className="clearance-page-subtitle">{tx.newRecord}</h3>
            <div className="clearance-page-section-actions">
              <button type="button" className="eu-btn" onClick={() => navigate("/payments")}>{tx.openPayments}</button>
              <button type="submit" form="clearance-submit-form" className="eu-btn primary" disabled={loading || (selectedReadiness && !selectedReadiness.ready_for_clearance)}>
                {loading ? tx.saving : tx.submitClearance}
              </button>
            </div>
          </div>
          <p className="eu-help">{tx.releaseRule}</p>

          <div className="eu-grid two">
            <label className="eu-field">
              <span>{tx.declaration}</span>
              <select value={form.declaration_id} onChange={(e) => onField("declaration_id", e.target.value)}>
                <option value="">{tx.selectDeclarationOption}</option>
                {declarations.map((d) => {
                  const r = readinessByDeclarationId.get(String(d.declaration_id));
                  const b = readinessBadge(r, tx);
                  return (
                    <option key={d.declaration_id} value={d.declaration_id}>
                      {d.declaration_no} [{b.text}]
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="eu-field">
              <span>{tx.releaseDate}</span>
              <input type="date" value={form.release_date} onChange={(e) => onField("release_date", e.target.value)} required />
            </label>

            <label className="eu-field">
              <span>{tx.officerName}</span>
              <input value={form.officer_name} onChange={(e) => onField("officer_name", e.target.value)} placeholder="Officer Almaz" required />
            </label>

            <label className="eu-field">
              <span>{tx.customsOffice}</span>
              <select
                value={CUSTOMS_OFFICE_OPTIONS.includes(form.customs_office) ? form.customs_office : (form.customs_office ? OTHER_VALUE : "")}
                onChange={(e) => onField("customs_office", e.target.value === OTHER_VALUE ? "" : e.target.value)}
                required
              >
                <option value="">Select customs office...</option>
                {CUSTOMS_OFFICE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value={OTHER_VALUE}>Other (type manually)</option>
              </select>
              {(form.customs_office && !CUSTOMS_OFFICE_OPTIONS.includes(form.customs_office)) && (
                <input
                  value={form.customs_office}
                  onChange={(e) => onField("customs_office", e.target.value)}
                  placeholder="Type customs office"
                  required
                />
              )}
            </label>

            <label className="eu-field">
              <span>{tx.deliveryNoteNumber}</span>
              <input value={form.delivery_note_no} onChange={(e) => onField("delivery_note_no", e.target.value)} placeholder="DN-88990" required />
            </label>

            <label className="eu-field">
              <span>{tx.transportCompany}</span>
              <input value={form.transport_company} onChange={(e) => onField("transport_company", e.target.value)} placeholder="EthioTrans Logistics" />
            </label>

            <label className="eu-field">
              <span>{tx.truckPlate}</span>
              <input value={form.truck_plate_no} onChange={(e) => onField("truck_plate_no", e.target.value)} placeholder="AB-12345" />
            </label>
          </div>

          <label className="eu-field" style={{ marginTop: 10 }}>
            <span>{tx.destinationAddress}</span>
            <select
              value={DESTINATION_ADDRESS_OPTIONS.includes(form.destination_address) ? form.destination_address : (form.destination_address ? OTHER_VALUE : "")}
              onChange={(e) => onField("destination_address", e.target.value === OTHER_VALUE ? "" : e.target.value)}
            >
              <option value="">Select destination address...</option>
              {DESTINATION_ADDRESS_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              <option value={OTHER_VALUE}>Other (type manually)</option>
            </select>
            {(form.destination_address && !DESTINATION_ADDRESS_OPTIONS.includes(form.destination_address)) && (
              <input
                value={form.destination_address}
                onChange={(e) => onField("destination_address", e.target.value)}
                placeholder="Type destination address"
              />
            )}
          </label>

          <div className="eu-status-panel">
            <h4>{tx.releaseSnapshot}</h4>
            <div className="eu-review-row"><span>{tx.declaration}</span><strong>{selectedDeclaration?.declaration_no || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.readiness}</span><strong><span style={{ background: badge.bg, color: badge.fg, borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{badge.text}</span></strong></div>
            <div className="eu-review-row"><span>{tx.releaseDate}</span><strong>{form.release_date || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.deliveryNote}</span><strong>{form.delivery_note_no || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.truckPlate}</span><strong>{form.truck_plate_no || "-"}</strong></div>
            {selectedReadiness && selectedReadiness.blockers?.length > 0 && (
              <div className="eu-review-row"><span>{tx.blockers}</span><strong>{selectedReadiness.blockers.join("; ")}</strong></div>
            )}
          </div>

          <div className="eu-nav clearance-page-actions clearance-page-submit-bar">
            <button type="button" className="eu-btn" onClick={() => navigate("/payments")}>{tx.openPayments}</button>
            <button type="submit" className="eu-btn primary" disabled={loading || (selectedReadiness && !selectedReadiness.ready_for_clearance)}>
              {loading ? tx.saving : tx.submitClearance}
            </button>
          </div>

          {error && <div className="err">{error}</div>}
        </form>

        <div className="clearance-page-section">
          <div className="clearance-page-section-head clearance-page-section-head--tight">
            <h3 className="clearance-page-subtitle">{tx.registry}</h3>
          </div>
          <div className="clearance-page-filter-row">
            <input
              value={declFilter}
              onChange={(e) => setDeclFilter(e.target.value)}
              placeholder={tx.filterByDeclarationId}
              className="clearance-page-filter"
            />
            {!!declFilter && (
              <button type="button" className="eu-btn" onClick={() => { setDeclFilter(""); navigate({ search: "" }); }}>
                {tx.clear}
              </button>
            )}
          </div>

          <div className="clearance-page-table-wrap">
            <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{tx.declaration}</th>
                  <th>{tx.releaseDate}</th>
                  <th>{tx.officer}</th>
                  <th>{tx.customsOffice}</th>
                  <th>{tx.deliveryNote}</th>
                  <th>{tx.transportCompany}</th>
                  <th>{tx.truckPlate}</th>
                  <th>{tx.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i) => (
                  <tr key={i.clearance_id}>
                    <td>{i.declaration_no || "-"}</td>
                    <td>{i.release_date || "-"}</td>
                    <td>{i.officer_name || "-"}</td>
                    <td>{i.customs_office || "-"}</td>
                    <td>{i.delivery_note_no || "-"}</td>
                    <td>{i.transport_company || "-"}</td>
                    <td>{i.truck_plate_no || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" className="eu-btn" onClick={() => openDetails(i)}>{tx.view}</button>
                        <button
                          type="button"
                          className="eu-btn"
                          disabled={downloadingId === String(i.clearance_id)}
                          onClick={() => downloadReleaseNote(i)}
                        >
                          {downloadingId === String(i.clearance_id) ? tx.downloading : tx.releaseNote}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="8">{tx.noRecords}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={detailOpen} title={tx.detailTitle} onClose={() => setDetailOpen(false)}>
        {detailLoading && <div>{tx.loadingDetail}</div>}
        {!detailLoading && !detailData && <div>{tx.noDetail}</div>}
        {!detailLoading && detailData && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="eu-review-row"><span>{tx.declarationNo}</span><strong>{detailData.declaration_no || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.declarationDate}</span><strong>{fmtDate(detailData.declaration_date)}</strong></div>
            <div className="eu-review-row"><span>{tx.importer}</span><strong>{detailData.company_name || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.shipmentRef}</span><strong>{detailData.shipment_reference || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.origin}</span><strong>{detailData.origin_country || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.destinationPort}</span><strong>{detailData.destination_port || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.releaseDate}</span><strong>{fmtDate(detailData.release_date)}</strong></div>
            <div className="eu-review-row"><span>{tx.officer}</span><strong>{detailData.officer_name || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.customsOffice}</span><strong>{detailData.customs_office || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.deliveryNote}</span><strong>{detailData.delivery_note_no || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.transportCompany}</span><strong>{detailData.transport_company || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.truckPlate}</span><strong>{detailData.truck_plate_no || "-"}</strong></div>
            <div className="eu-review-row"><span>{tx.destinationAddress}</span><strong>{detailData.destination_address || "-"}</strong></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const EN = {
  unknown: "Unknown", ready: "Ready", cleared: "Cleared", blocked: "Blocked",
  failedLoad: "Failed to load clearances", selectDeclaration: "Please select a declaration.",
  declarationNotReady: "Declaration not ready", recordSubmitted: "Clearance record submitted.",
  failedSave: "Failed to save clearance", releaseDownloaded: "Release note downloaded.",
  releaseDownloadFailed: "Failed to download release note", detailFailed: "Failed to load clearance detail",
  clearanceControl: "Clearance Control", finalRelease: "Final release workflow after payment and passed inspection",
  readyQueue: "Ready for Clearance Queue", noneReady: "No declarations are currently ready.",
  newRecord: "New Clearance Record", releaseRule: "Release is allowed only when payment is Paid and inspection result is Passed.",
  declaration: "Declaration", selectDeclarationOption: "Select declaration...", releaseDate: "Release Date",
  officerName: "Officer Name", customsOffice: "Customs Office", deliveryNoteNumber: "Delivery Note Number",
  transportCompany: "Transport Company", truckPlate: "Truck Plate", destinationAddress: "Destination Address",
  releaseSnapshot: "Release Snapshot", readiness: "Readiness", deliveryNote: "Delivery Note", blockers: "Blockers",
  openPayments: "Open Payments", saving: "Saving...", saveClearance: "Save Clearance", submitClearance: "Submit Clearance",
  registry: "Clearance Registry", filterByDeclarationId: "Filter by declaration_id", clear: "Clear",
  officer: "Officer", actions: "Actions", view: "View", downloading: "Downloading...", releaseNote: "Release Note",
  noRecords: "No clearance records found.", detailTitle: "Clearance Detail", loadingDetail: "Loading clearance detail...",
  noDetail: "No detail found.", declarationNo: "Declaration No", declarationDate: "Declaration Date",
  importer: "Importer", shipmentRef: "Shipment Ref", origin: "Origin", destinationPort: "Destination Port",
};

const AM = {
  unknown: "á‹«áˆá‰³á‹ˆá‰€", ready: "á‹áŒáŒ", cleared: "á‰°áˆá‰µá‰·áˆ", blocked: "á‰³áŒá‹·áˆ",
  failedLoad: "áŠ­áˆŠáˆ«áŠ•áˆ¶á‰½áŠ• áˆ˜áŒ«áŠ• áŠ áˆá‰°áˆ³áŠ«áˆ", selectDeclaration: "áŠ¥á‰£áŠ­á‹Ž áˆ˜áŒáˆˆáŒ« á‹­áˆáˆ¨áŒ¡á¢",
  declarationNotReady: "áˆ˜áŒáˆˆáŒ«á‹ á‹áŒáŒ áŠ á‹­á‹°áˆˆáˆ", recordSubmitted: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ áˆ˜á‹áŒˆá‰¥ á‰°áˆáŠ³áˆá¢",
  failedSave: "áŠ­áˆŠáˆ«áŠ•áˆµ áˆ›áˆµá‰€áˆ˜áŒ¥ áŠ áˆá‰°áˆ³áŠ«áˆ", releaseDownloaded: "á‹¨áˆ˜áˆá‰€á‰‚á‹« áˆ›áˆµá‰³á‹ˆá‰‚á‹« á‹ˆáˆ­á‹·áˆá¢",
  releaseDownloadFailed: "á‹¨áˆ˜áˆá‰€á‰‚á‹« áˆ›áˆµá‰³á‹ˆá‰‚á‹« áˆ›á‹áˆ¨á‹µ áŠ áˆá‰°áˆ³áŠ«áˆ", detailFailed: "á‹áˆ­á‹áˆ­ áˆ˜áŒ«áŠ• áŠ áˆá‰°áˆ³áŠ«áˆ",
  clearanceControl: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ á‰áŒ¥áŒ¥áˆ­", finalRelease: "áŠ­áá‹« áŠ¥áŠ“ áˆáˆ­áˆ˜áˆ« áŠ¨á‰°áˆŸáˆ‰ á‰ áŠ‹áˆ‹ á‹¨áˆ˜áŒ¨áˆ¨áˆ» áˆ˜áˆá‰€á‰…",
  readyQueue: "áˆˆáŠ­áˆŠáˆ«áŠ•áˆµ á‹áŒáŒ á‰°áˆ«", noneReady: "á‰ áŠ áˆáŠ‘ áŒŠá‹œ á‹áŒáŒ áˆ˜áŒáˆˆáŒ« á‹¨áˆˆáˆá¢",
  newRecord: "áŠ á‹²áˆµ á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ áˆ˜á‹áŒˆá‰¥", releaseRule: "áŠ­áá‹« á‰°áŠ¨ááˆŽ áˆáˆ­áˆ˜áˆ« áŠ«áˆˆáˆ á‰¥á‰» áˆ˜áˆá‰€á‰… á‹­áˆá‰€á‹³áˆá¢",
  declaration: "áˆ˜áŒáˆˆáŒ«", selectDeclarationOption: "áˆ˜áŒáˆˆáŒ« á‹­áˆáˆ¨áŒ¡...", releaseDate: "á‹¨áˆ˜áˆá‰€á‰‚á‹« á‰€áŠ•",
  officerName: "á‹¨áŠ¦áŠáˆ°áˆ­ áˆµáˆ", customsOffice: "á‹¨áŒ‰áˆáˆ©áŠ­ á‰¢áˆ®", deliveryNoteNumber: "á‹¨áˆ˜áˆá‰€á‰‚á‹« á‹ˆáˆ¨á‰€á‰µ á‰áŒ¥áˆ­",
  transportCompany: "á‹¨á‰µáˆ«áŠ•áˆµá–áˆ­á‰µ áŠ©á‰£áŠ•á‹«", truckPlate: "á‹¨á‰µáˆ«áŠ­ áˆ°áˆŒá‹³", destinationAddress: "á‹¨áˆ˜á‹µáˆ¨áˆ» áŠ á‹µáˆ«áˆ»",
  releaseSnapshot: "á‹¨áˆ˜áˆá‰€á‰‚á‹« áˆ›áŒ á‰ƒáˆˆá‹«", readiness: "á‹áŒáŒáŠá‰µ", deliveryNote: "á‹¨áˆ˜áˆá‰€á‰‚á‹« á‹ˆáˆ¨á‰€á‰µ", blockers: "áŠ¥áŠ•á‰…á‹á‰¶á‰½",
  openPayments: "áŠ­áá‹«á‹Žá‰½áŠ• áŠ­áˆá‰µ", saving: "á‰ áˆ›áˆµá‰€áˆ˜áŒ¥ áˆ‹á‹­...", saveClearance: "áŠ­áˆŠáˆ«áŠ•áˆµ áŠ áˆµá‰€áˆáŒ¥", submitClearance: "áŠ­áˆŠáˆ«áŠ•áˆµ áˆáŠ­",
  registry: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ áˆ˜á‹áŒˆá‰¥", filterByDeclarationId: "á‰  declaration_id áŠ áŒ£áˆ«", clear: "áŠ áŒ¥á‹",
  officer: "áŠ¦áŠáˆ°áˆ­", actions: "áŠ¥áˆ­áˆáŒƒá‹Žá‰½", view: "áŠ¥á‹­á‰³", downloading: "á‰ áˆ›á‹áˆ¨á‹µ áˆ‹á‹­...", releaseNote: "á‹¨áˆ˜áˆá‰€á‰‚á‹« áˆ›áˆµá‰³á‹ˆá‰‚á‹«",
  noRecords: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ áˆ˜á‹áŒˆá‰¥ áŠ áˆá‰°áŒˆáŠ˜áˆá¢", detailTitle: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ á‹áˆ­á‹áˆ­", loadingDetail: "á‹¨áŠ­áˆŠáˆ«áŠ•áˆµ á‹áˆ­á‹áˆ­ á‰ áˆ˜áŒ«áŠ• áˆ‹á‹­...",
  noDetail: "á‹áˆ­á‹áˆ­ áŠ áˆá‰°áŒˆáŠ˜áˆá¢", declarationNo: "á‹¨áˆ˜áŒáˆˆáŒ« á‰áŒ¥áˆ­", declarationDate: "á‹¨áˆ˜áŒáˆˆáŒ« á‰€áŠ•",
  importer: "áŠ áˆµáˆ˜áŒª", shipmentRef: "á‹¨áŒ­áŠá‰µ áˆ›áŒ£á‰€áˆ»", origin: "áˆ˜áŠáˆ»", destinationPort: "á‹¨áˆ˜á‹µáˆ¨áˆ» á‹ˆá‹°á‰¥",
};







