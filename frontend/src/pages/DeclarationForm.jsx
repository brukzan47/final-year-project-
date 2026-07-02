import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { ShipmentsAPI } from "../api/shipmentAPI.js";
import { DocumentsAPI } from "../api/documentAPI.js";
import { SmartAPI } from "../api/smartAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import "../styles/shipmentWizard.css";
const CURRENCY_OPTIONS = ["USD", "ETB", "EUR", "GBP", "CNY", "AED", "SAR", "KES"];
const TARIFF_OPTIONS = ["0", "5", "10", "15", "20", "30", "35", "40", "custom"];
const DECLARATION_FORM_ID = "declaration-submit-form";
const CUSTOMS_STATION_OPTIONS = [
  "Addis Ababa Bole",
  "Modjo",
  "Kality",
  "Dire Dawa",
  "Moyale",
  "Metema",
  "Galafi",
  "Djibouti Corridor",
];
const OTHER_VALUE = "__OTHER__";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genDeclarationNo() {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `DEC-ET-${y}-${seq}`;
}

export default function DeclarationForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();

  const [form, setForm] = useState({
    shipment_id: "",
    declaration_no: "",
    declaration_date: todayIso(),
    declarant_agent: "",
    customs_station: "",
    valuation_basis: "CIF",
    currency: "USD",
    tariff_rate: "",
    duties_etb: "",
    payment_receipt_no: "",
  });

  const [items, setItems] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [declFilter, setDeclFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDeclId, setDocsDeclId] = useState("");
  const [docsErr, setDocsErr] = useState("");
  const [docItems, setDocItems] = useState([]);
  const [ocrPreview, setOcrPreview] = useState({});
  const [ocrLoadingId, setOcrLoadingId] = useState("");

  const highlightRef = useRef(null);

  const declaredShipmentIds = useMemo(
    () => new Set((items || []).map((d) => String(d.shipment_id || "")).filter(Boolean)),
    [items]
  );

  const availableShipments = useMemo(
    () => (shipments || []).filter((s) => !declaredShipmentIds.has(String(s.shipment_id))),
    [shipments, declaredShipmentIds]
  );

  const selectedShipment = useMemo(
    () => availableShipments.find((s) => String(s.shipment_id) === String(form.shipment_id)) || null,
    [availableShipments, form.shipment_id]
  );
  const canSubmit = !!form.shipment_id && !loading;

  const calcPreview = useMemo(() => {
    const cifUsd = Number(form?.duties_etb ? 0 : selectedShipment?.cif_value_usd || 0);
    const tariff = Number(form.tariff_rate || 0);
    const fx = 130;
    const estDuty = cifUsd > 0 && tariff > 0 ? (cifUsd * fx * tariff) / 100 : 0;
    return {
      cifUsd,
      exchangeRate: fx,
      estDuty,
    };
  }, [selectedShipment, form.tariff_rate, form?.duties_etb]);

  const load = useCallback(async () => {
    try {
      setError("");
      const [decls, ships] = await Promise.all([DeclarationsAPI.list(), ShipmentsAPI.list()]);
      setItems(Array.isArray(decls) ? decls : []);
      setShipments(Array.isArray(ships) ? ships : []);
    } catch (e) {
      setError(e.message || t("failedToLoadDeclarations"));
      toast?.error?.(e.message || t("failedToLoadDeclarations"));
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (form.shipment_id && declaredShipmentIds.has(String(form.shipment_id))) {
      setForm((prev) => ({ ...prev, shipment_id: "" }));
    }
  }, [declaredShipmentIds, form.shipment_id]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const d = p.get("declaration_id") || "";
      if (d) setDeclFilter(d);
    } catch {}
  }, [location.search]);

  useEffect(() => {
    if (highlightRef.current) {
      try {
        highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
    }
  }, [items, declFilter]);

  const onField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.shipment_id) {
      setError(t("pleaseSelectShipment"));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        declaration_no: (form.declaration_no || "").trim().toUpperCase(),
      };
      const created = await DeclarationsAPI.create(payload);
      toast?.success?.(t("declarationSubmittedSuccessfully"));
      setForm({
        shipment_id: "",
        declaration_no: "",
        declaration_date: todayIso(),
        declarant_agent: "",
        customs_station: "",
        valuation_basis: "CIF",
        currency: "USD",
        tariff_rate: "",
        duties_etb: "",
        payment_receipt_no: "",
      });
      await load();
      if (role === "Importer" && created?.declaration_id) {
        navigate(`/payments?declaration_id=${encodeURIComponent(created.declaration_id)}&created=1`);
      }
    } catch (e) {
      setError(e.message || t("failedToSubmitDeclaration"));
      toast?.error?.(e.message || t("failedToSubmitDeclaration"));
    } finally {
      setLoading(false);
    }
  };

  const openDocs = useCallback(async (declarationId) => {
    setDocsOpen(true);
    setDocsDeclId(declarationId);
    setDocsErr("");
    setOcrPreview({});
    try {
      const list = await DocumentsAPI.listByDeclaration(declarationId);
      setDocItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setDocsErr(e.message || t("failedToLoadDocuments"));
    }
  }, [t]);

  const openDocument = async (doc) => {
    try {
      const blob = await DocumentsAPI.downloadFile(doc.document_id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast?.error?.(e.message || t("failedToLoadDocuments"));
    }
  };

  const clearDeclFilter = useCallback(() => {
    setDeclFilter("");
    navigate({ search: "" });
  }, [navigate]);

  const uploadDeclarationDocs = useCallback((declarationId) => {
    navigate(`/file-upload?declaration_id=${declarationId}`);
  }, [navigate]);

  const approveDeclaration = useCallback(async (declarationId) => {
    try {
      await DeclarationsAPI.approve(declarationId);
      await load();
      toast?.success?.(t("declarationApproved"));
    } catch (e) {
      toast?.error?.(e.message || t("approveFailed"));
    }
  }, [load, t, toast]);

  const rejectDeclaration = useCallback(async (declarationId) => {
    const reason = window.prompt(t("rejectionReasonOptional")) || "";
    try {
      await DeclarationsAPI.reject(declarationId, reason);
      await load();
      toast?.success?.(t("declarationRejected"));
    } catch (e) {
      toast?.error?.(e.message || t("rejectFailed"));
    }
  }, [load, t, toast]);

  return (
    <div className="declaration-form-page-shell">
      <div className="declaration-form-page-panel">
        <div className="declaration-form-page-section declaration-form-page-section--head">
          <div className="declaration-form-page-section-head">
            <div>
              <div className="declaration-form-page-kicker">{t("newDeclaration")}</div>
              <h2 className="declaration-form-page-title">{t("newDeclaration")}</h2>
            </div>
            <div className="declaration-form-page-actions">
              <button
                type="submit"
                form={DECLARATION_FORM_ID}
                className="eu-btn primary"
                disabled={!canSubmit}
              >
                {loading ? t("submitting") : t("submitDeclaration")}
              </button>
            </div>
          </div>
        </div>

      <form id={DECLARATION_FORM_ID} onSubmit={submit} className="eu-card declaration-form-page-card">

        <div className="eu-grid two">
          <label className="eu-field">
            <span>{t("shipment")}</span>
            <select value={form.shipment_id} onChange={(e) => onField("shipment_id", e.target.value)}>
              <option value="">{t("selectShipment")}</option>
              {availableShipments.map((s) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.shipment_reference} - {s.company_name}
                </option>
              ))}
            </select>
            {availableShipments.length === 0 && (
              <small style={{ color: "#6b7c93" }}>{t("allShipmentsAlreadyDeclared")}</small>
            )}
          </label>

          <label className="eu-field">
            <span>{t("declarationNumber")}</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={form.declaration_no}
                onChange={(e) => onField("declaration_no", e.target.value.toUpperCase())}
                placeholder={t("autoIfEmpty")}
              />
              <button type="button" className="eu-btn" onClick={() => onField("declaration_no", genDeclarationNo())}>
                {t("auto")}
              </button>
            </div>
          </label>

          <label className="eu-field">
            <span>{t("declarationDate")}</span>
            <input type="date" value={form.declaration_date} onChange={(e) => onField("declaration_date", e.target.value)} />
          </label>

          <label className="eu-field">
            <span>{t("declarantAgent")}</span>
            <input value={form.declarant_agent} onChange={(e) => onField("declarant_agent", e.target.value)} placeholder="XYZ Logistics PLC" />
          </label>

          <label className="eu-field">
            <span>{t("customsStation")}</span>
            <select
              value={CUSTOMS_STATION_OPTIONS.includes(form.customs_station) ? form.customs_station : (form.customs_station ? OTHER_VALUE : "")}
              onChange={(e) => onField("customs_station", e.target.value === OTHER_VALUE ? "" : e.target.value)}
            >
              <option value="">Select customs station...</option>
              {CUSTOMS_STATION_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={OTHER_VALUE}>Other (type manually)</option>
            </select>
            {(form.customs_station && !CUSTOMS_STATION_OPTIONS.includes(form.customs_station)) && (
              <input
                value={form.customs_station}
                onChange={(e) => onField("customs_station", e.target.value)}
                placeholder="Type customs station"
              />
            )}
          </label>

          <label className="eu-field">
            <span>{t("valuationBasis")}</span>
            <input value={form.valuation_basis} onChange={(e) => onField("valuation_basis", e.target.value)} placeholder="CIF" />
          </label>

          <label className="eu-field">
            <span>{t("currency")}</span>
            <select value={form.currency} onChange={(e) => onField("currency", e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="eu-field">
            <span>{t("tariffRatePercent")}</span>
            <select
              value={TARIFF_OPTIONS.includes(String(form.tariff_rate)) ? String(form.tariff_rate) : "custom"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "custom") return;
                onField("tariff_rate", v);
              }}
            >
              <option value="">{t("selectRate")}</option>
              {TARIFF_OPTIONS.map((r) => (
                <option key={r} value={r}>{r === "custom" ? t("custom") : r}</option>
              ))}
            </select>
          </label>

          {(!TARIFF_OPTIONS.includes(String(form.tariff_rate)) || form.tariff_rate === "custom") && (
            <label className="eu-field">
              <span>{t("customTariffPercent")}</span>
              <input type="number" step="0.01" value={form.tariff_rate} onChange={(e) => onField("tariff_rate", e.target.value)} />
            </label>
          )}

          <label className="eu-field">
            <span>{t("dutiesEtb")}</span>
            <input type="number" step="0.01" value={form.duties_etb} onChange={(e) => onField("duties_etb", e.target.value)} placeholder={t("optionalManualAmount")} />
          </label>

          <label className="eu-field">
            <span>{t("paymentReceiptNumber")}</span>
            <input value={form.payment_receipt_no} onChange={(e) => onField("payment_receipt_no", e.target.value)} placeholder="PR-54231" />
          </label>
        </div>

        <div className="eu-preview">
          <div>{t("estimatedPreview")}</div>
          <div>{t("cifValueUsd")}: {calcPreview.cifUsd.toLocaleString()}</div>
          <div>{t("exchangeRate")}: {calcPreview.exchangeRate.toLocaleString()} ETB/USD</div>
          <div>{t("estimatedDutyEtb")}: {Math.round(calcPreview.estDuty).toLocaleString()}</div>
        </div>

        <div className="eu-nav" style={{ justifyContent: "space-between" }}>
          <button type="button" className="eu-btn" onClick={() => navigate("/shipments")}>{t("addShipment")}</button>
          <button type="submit" className="eu-btn primary" disabled={!canSubmit}>{loading ? t("submitting") : t("submitDeclaration")}</button>
        </div>

        {error && <div className="err">{error}</div>}
      </form>

      <DeclarationRegistry
        items={items}
        declFilter={declFilter}
        onFilterChange={setDeclFilter}
        onClearFilter={clearDeclFilter}
        role={role}
        highlightRef={highlightRef}
        onOpenDocs={openDocs}
        onUploadDocs={uploadDeclarationDocs}
        onApprove={approveDeclaration}
        onReject={rejectDeclaration}
        t={t}
      />

      <Modal open={docsOpen} title={t("declarationDocuments")} onClose={() => setDocsOpen(false)}>
        <div style={{ display: "grid", gap: 10 }}>
          {docsErr && <div className="err">{docsErr}</div>}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{t("uploadManagedInFileUpload")}</span>
            <button type="button" className="eu-btn" onClick={() => navigate(`/file-upload${docsDeclId ? `?declaration_id=${docsDeclId}` : ""}`)}>
              {t("goToFileUpload")}
            </button>
          </div>

          {docItems.length === 0 ? (
            <div>{t("noDocumentsForDeclaration")}</div>
          ) : (
            <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File</th>
                  <th>Type</th>
                  <th>{t("uploaded")}</th>
                  <th>{t("open")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {docItems.map((d) => (
                  <tr key={d.document_id}>
                    <td>{d.title || "-"}</td>
                    <td>{d.file_name}</td>
                    <td>{d.file_type || "-"}</td>
                    <td>{d.uploaded_at}</td>
                    <td>{d.document_id ? (<button type="button" className="eu-btn" onClick={() => openDocument(d)}>Open</button>) : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="eu-btn"
                          onClick={async () => {
                            try {
                              if (!window.confirm(t("deleteThisDocument"))) return;
                              await DocumentsAPI.delete(d.document_id);
                              const list = await DocumentsAPI.listByDeclaration(docsDeclId);
                              setDocItems(Array.isArray(list) ? list : []);
                              toast?.success?.(t("documentDeleted"));
                            } catch (e) {
                              toast?.error?.(e.message || t("deleteFailed"));
                            }
                          }}
                        >
                          {t("delete")}
                        </button>
                        <button
                          type="button"
                          className="eu-btn"
                          disabled={ocrLoadingId === d.document_id}
                          onClick={async () => {
                            try {
                              setOcrLoadingId(d.document_id);
                              const res = await SmartAPI.ocrExtract({ document_id: d.document_id, file_name: d.file_name });
                              setOcrPreview((prev) => ({ ...prev, [d.document_id]: res }));
                            } catch (e) {
                              toast?.error?.(e.message || t("previewFailed"));
                            } finally {
                              setOcrLoadingId("");
                            }
                          }}
                        >
                          {ocrLoadingId === d.document_id ? t("previewing") : t("preview")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {Object.keys(ocrPreview).length > 0 && (
            <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("ocrPreview")}</div>
              {Object.entries(ocrPreview).map(([id, data]) => (
                <div key={id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Document {id}</div>
                  <pre className="smart-pre" style={{ background: "#f8f9fa", padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", overflowX: "auto" }}>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      </div>
    </div>
  );
}

const DeclarationRegistry = React.memo(function DeclarationRegistry({
  items,
  declFilter,
  onFilterChange,
  onClearFilter,
  role,
  highlightRef,
  onOpenDocs,
  onUploadDocs,
  onApprove,
  onReject,
  t,
}) {
  const filteredItems = useMemo(() => {
    if (!declFilter) return items;
    return items.filter((i) => String(i.declaration_id) === String(declFilter));
  }, [items, declFilter]);

  const canReview = role === "Admin" || role === "Super Admin" || role === "Customs Officer";

  return (
    <div className="declaration-form-page-section declaration-form-page-section--registry">
      <div className="declaration-form-page-section-head declaration-form-page-section-head--tight">
        <div>
          <div className="declaration-form-page-kicker">{t("declarationsRegistry")}</div>
          <h3 className="declaration-form-page-subtitle">{t("declarationsRegistry")}</h3>
        </div>
      </div>
      <div className="declaration-form-page-filter-row">
        <input
          value={declFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder={t("filterByDeclarationId")}
          className="declaration-form-page-filter"
        />
        {!!declFilter && (
          <button type="button" className="eu-btn" onClick={onClearFilter}>
            {t("clear")}
          </button>
        )}
      </div>

      <div className="declaration-form-page-table-wrap">
        <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>{t("declarationNo")}</th>
              <th>{t("dateShort")}</th>
              <th>{t("tariffPercent")}</th>
              <th>{t("dutiesEtb")}</th>
              <th>{t("shipment")}</th>
              <th>{t("importer")}</th>
              <th>{t("risk")}</th>
              <th>{t("status")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((i) => {
              const isHighlight = declFilter && String(i.declaration_id) === String(declFilter);
              return (
                <tr
                  key={i.declaration_id || i.declaration_no}
                  ref={isHighlight ? highlightRef : null}
                  style={isHighlight ? { outline: "2px solid #2c65a5", background: "#eef5fd" } : {}}
                >
                  <td>{i.declaration_no}</td>
                  <td>{i.declaration_date}</td>
                  <td>{i.tariff_rate}</td>
                  <td>{i.duties_etb}</td>
                  <td>{i.shipment_reference}</td>
                  <td>{i.company_name}</td>
                  <td><RiskBadge channel={i.risk_channel || "Green"} score={Number(i.risk_score || 0)} /></td>
                  <td><StatusBadge status={i.status || "Pending"} /></td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="eu-btn" onClick={() => onOpenDocs(i.declaration_id)}>{t("documents")}</button>
                    <button type="button" className="eu-btn" onClick={() => onUploadDocs(i.declaration_id)}>{t("upload")}</button>
                    {canReview && (
                      <>
                        <button type="button" className="eu-btn" onClick={() => onApprove(i.declaration_id)}>
                          {t("approve")}
                        </button>
                        <button type="button" className="eu-btn" onClick={() => onReject(i.declaration_id)}>
                          {t("reject")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan="9">{t("noDeclarationRecordsFound")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

