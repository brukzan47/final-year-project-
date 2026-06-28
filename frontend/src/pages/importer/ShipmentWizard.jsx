import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { ImportersAPI } from "../../api/importerAPI.js";
import { ShipmentsAPI } from "../../api/shipmentAPI.js";
import { DocumentsAPI } from "../../api/documentAPI.js";
import ShipmentStep1Operator from "./ShipmentStep1Operator.jsx";
import ShipmentStep2Goods from "./ShipmentStep2Goods.jsx";
import ShipmentStep3Transport from "./ShipmentStep3Transport.jsx";
import ShipmentStep4Value from "./ShipmentStep4Value.jsx";
import ShipmentStep5Documents from "./ShipmentStep5Documents.jsx";
import ShipmentReview from "./ShipmentReview.jsx";
import "../../styles/shipmentWizard.css";
const STEPS = [
  "Importer",
  "Goods Classification",
  "Transport Routing",
  "Customs Valuation",
  "Supporting Documents",
  "Review & Submit",
];

function genRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return `SHP-${y}${m}${day}-${seq}`;
}

export default function ShipmentWizard() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const { role, importerId } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [importers, setImporters] = useState([]);
  const [loadingImporters, setLoadingImporters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const [data, setData] = useState({
    operator: { importer_id: "", operator_ref: "" },
    goods: {
      hs_code: "",
      description: "",
      quantity: "",
      unit_of_measure: "pcs",
      goods_type: "",
      origin_country: "",
      net_weight_kg: "",
      gross_weight_kg: "",
    },
    transport: {
      mode_of_transport: "",
      port_of_loading: "",
      destination_port: "",
      container_no: "",
      bill_of_lading: "",
      arrival_date: "",
    },
    value: {
      invoice_value_usd: "",
      cif_value_usd: "",
      exchange_rate: 130,
      tariff_rate: "",
      vat_rate: "",
      tariff_source: "",
    },
    documents: { files: [] },
    generatedRef: "",
  });

  useEffect(() => {
    if (role === "Importer" && importerId) {
      setData((prev) => ({ ...prev, operator: { ...prev.operator, importer_id: importerId } }));
    }
  }, [role, importerId]);

  useEffect(() => {
    const load = async () => {
      if (role === "Importer") return;
      setLoadingImporters(true);
      try {
        const list = await ImportersAPI.list();
        setImporters(Array.isArray(list) ? list : []);
      } catch {
        setImporters([]);
      } finally {
        setLoadingImporters(false);
      }
    };
    load();
  }, [role]);

  const localizedSteps = useMemo(() => (lang === "am" ? STEPS_AM : STEPS_EN), [lang]);
  const stepLabel = useMemo(() => localizedSteps[step - 1] || "", [step, localizedSteps]);

  const next = () => setStep((s) => Math.min(6, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));
  const patch = (section, partial) => {
    setData((prevData) => ({
      ...prevData,
      [section]: { ...(prevData[section] || {}), ...(partial || {}) },
    }));
  };

  const downloadSummary = () => {
    const timeline = [
      { step: "Submitted", status: "Completed" },
      { step: "Inspection", status: "Pending" },
      { step: "Payment", status: "Not Required Yet" },
      { step: "Cleared", status: "Awaiting" },
    ];
    const files = Array.isArray(data.documents?.files) ? data.documents.files : [];
    const shipmentRef = result?.shipment_reference || data.generatedRef || "-";
    const shipmentId = result?.shipment_id || "-";
    const rateSource = String(data.value?.tariff_source || "").toLowerCase().includes("taric")
      ? "TARIC Live"
      : "Manual Entry";
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shipment Summary</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1 { margin: 0 0 8px 0; color: #fff; }
    h2 { margin: 18px 0 8px 0; color: #fff; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    .meta { color: #6b7280; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Shipment Submission Summary</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()}</div>

  <h2>Shipment</h2>
  <table>
    <tr><th>Shipment ID</th><td>${shipmentId}</td></tr>
    <tr><th>Shipment Reference</th><td>${shipmentRef}</td></tr>
    <tr><th>Importer ID</th><td>${data.operator?.importer_id || "-"}</td></tr>
  </table>

  <h2>Goods</h2>
  <table>
    <tr><th>HS Code</th><td>${data.goods?.hs_code || "-"}</td></tr>
    <tr><th>Description</th><td>${data.goods?.description || "-"}</td></tr>
    <tr><th>Origin</th><td>${data.goods?.origin_country || "-"}</td></tr>
    <tr><th>Quantity</th><td>${data.goods?.quantity || "-"}</td></tr>
  </table>

  <h2>Transport</h2>
  <table>
    <tr><th>Mode</th><td>${data.transport?.mode_of_transport || "-"}</td></tr>
    <tr><th>Port of Loading</th><td>${data.transport?.port_of_loading || "-"}</td></tr>
    <tr><th>Port of Entry</th><td>${data.transport?.destination_port || "-"}</td></tr>
    <tr><th>Container Number</th><td>${data.transport?.container_no || "-"}</td></tr>
    <tr><th>BL / AWB</th><td>${data.transport?.bill_of_lading || "-"}</td></tr>
  </table>

  <h2>Customs Value</h2>
  <table>
    <tr><th>CIF (USD)</th><td>${data.value?.cif_value_usd || "-"}</td></tr>
    <tr><th>Duty Rate (%)</th><td>${data.value?.tariff_rate || "-"}</td></tr>
    <tr><th>VAT Rate (%)</th><td>${data.value?.vat_rate || "-"}</td></tr>
    <tr><th>Rates Source</th><td>${rateSource}</td></tr>
  </table>

  <h2>Documents</h2>
  <table>
    <tr><th>Total Documents</th><td>${files.length}</td></tr>
    ${files.map((f) => `<tr><th>${f.title || "Document"}</th><td>${f.file_name || "-"}</td></tr>`).join("")}
  </table>

  <h2>Status Timeline</h2>
  <table>
    ${timeline.map((t) => `<tr><th>${t.step}</th><td>${t.status}</td></tr>`).join("")}
  </table>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
    const w = window.open("", "_blank", "width=920,height=760");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const submit = async () => {
    setErr("");
    const ref = data.generatedRef || genRef();
    const payload = {
      importer_id: data.operator.importer_id || importerId || "",
      shipment_reference: ref,
      tracking_ref: data.transport.bill_of_lading || data.transport.container_no || "",
      description_of_goods: data.goods.description,
      goods_type: data.goods.goods_type || "General Goods",
      hs_code: data.goods.hs_code,
      quantity: data.goods.quantity,
      unit_of_measure: data.goods.unit_of_measure || "pcs",
      cif_value_usd: data.value.cif_value_usd || data.value.invoice_value_usd,
      origin_country: data.goods.origin_country,
      destination_port: data.transport.destination_port,
      mode_of_transport: data.transport.mode_of_transport,
      arrival_date: data.transport.arrival_date,
    };

    if (!payload.importer_id) {
      setErr(t.importerRequired);
      return;
    }
    setSubmitting(true);
    try {
      const created = await ShipmentsAPI.create(payload);
      const shipmentId = created?.shipment_id;
      const docIds = (Array.isArray(data.documents?.files) ? data.documents.files : [])
        .map((d) => d?.document_id)
        .filter(Boolean);
      if (shipmentId && docIds.length > 0) {
        try {
          await DocumentsAPI.linkToShipment({ shipment_id: shipmentId, document_ids: docIds });
        } catch {
          // Do not block shipment submission if document-link step fails.
        }
      }
      setData((prevData) => ({ ...prevData, generatedRef: ref }));
      setResult(created || { shipment_reference: ref });
      toast?.success?.(t.shipmentSubmittedSuccess);
    } catch (e) {
      setErr(e.message || t.failedSubmit);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="eu-wizard">
      <div className="eu-head">
      </div>

      <div className="eu-step-top">
        <div className="eu-step-index">{t.stepOf.replace("{step}", step).replace("{total}", 6)}</div>
        <div className="eu-step-name">{stepLabel}</div>
      </div>

      <div className="eu-progress">
        {localizedSteps.map((name, idx) => (
          <div key={name} className={`eu-progress-item ${idx + 1 <= step ? "active" : ""}`}>
            <span>{idx + 1}</span>
            <small>{name}</small>
          </div>
        ))}
      </div>

      {loadingImporters && <div className="eu-loading">{t.loadingImporters}</div>}

      {!result && step === 1 && (
        <ShipmentStep1Operator
          data={data.operator}
          role={role}
          importerId={importerId}
          importers={importers}
          onChange={(v) => patch("operator", v)}
          next={next}
        />
      )}
      {!result && step === 2 && (
        <ShipmentStep2Goods
          data={data.goods}
          onChange={(v) => patch("goods", v)}
          next={next}
          prev={prev}
        />
      )}
      {!result && step === 3 && (
        <ShipmentStep3Transport
          data={data.transport}
          onChange={(v) => patch("transport", v)}
          next={next}
          prev={prev}
        />
      )}
      {!result && step === 4 && (
        <ShipmentStep4Value
          data={data.value}
          onChange={(v) => patch("value", v)}
          suggestedDutyRate={data.goods?.taric_duty_rate}
          suggestedVatRate={data.goods?.taric_vat_rate}
          suggestedSource={data.goods?.taric_source}
          next={next}
          prev={prev}
        />
      )}
      {!result && step === 5 && (
        <ShipmentStep5Documents
          data={data.documents}
          onChange={(v) => patch("documents", v)}
          next={next}
          prev={prev}
        />
      )}
      {!result && step === 6 && (
        <ShipmentReview
          data={data}
          prev={prev}
          submit={submit}
          submitting={submitting}
          error={err}
          downloadSummary={downloadSummary}
        />
      )}

      {result && (
        <div className="eu-card">
          <h3>{t.shipmentSubmitted}</h3>
          <div className="eu-review-row">
            <span>{t.shipmentId}</span>
            <strong>{result.shipment_id || "-"}</strong>
          </div>
          <div className="eu-review-row">
            <span>{t.shipmentReference}</span>
            <strong>{result.shipment_reference || data.generatedRef || "-"}</strong>
          </div>
          <div className="eu-review-row">
            <span>{t.status}</span>
            <strong>{t.submitted}</strong>
          </div>
          <div className="eu-status-panel">
            <h4>{t.statusTracking}</h4>
            <div className="eu-status-id">{t.shipmentRef}: {result.shipment_reference || data.generatedRef || "-"}</div>
            <div className="eu-timeline">
              <div className="eu-timeline-item"><span>{t.submitted}</span><span>{t.completed}</span></div>
              <div className="eu-timeline-item"><span>{t.inspection}</span><span>{t.pending}</span></div>
              <div className="eu-timeline-item"><span>{t.payment}</span><span>{t.notRequiredYet}</span></div>
              <div className="eu-timeline-item"><span>{t.cleared}</span><span>{t.awaiting}</span></div>
            </div>
          </div>
          <div className="eu-nav">
            <button className="eu-btn" type="button" onClick={downloadSummary}>
              {t.downloadSummary}
            </button>
            <button
              className="eu-btn primary"
              onClick={() => {
                setResult(null);
                setStep(1);
                setErr("");
                setData((prev) => ({
                  ...prev,
                  documents: { files: [] },
                  generatedRef: "",
                }));
              }}
            >
              {t.registerAnother}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STEPS_EN = [
  "Importer",
  "Goods Classification",
  "Transport Routing",
  "Customs Valuation",
  "Supporting Documents",
  "Review & Submit",
];

const STEPS_AM = [
  "áŠ áˆµáˆ˜áŒª",
  "á‹¨áŠ¥á‰ƒ áˆ˜á‹°á‰ áŠ› áŠ®á‹µ",
  "á‹¨á‰µáˆ«áŠ•áˆµá–áˆ­á‰µ áˆ˜áŠ•áŒˆá‹µ",
  "á‹¨áŒ‰áˆáˆ©áŠ­ á‹‹áŒ‹ áŒáˆá‰µ",
  "á‹¨áˆšá‹°áŒá‰ áˆ°áŠá‹¶á‰½",
  "á‹­áŒˆáˆáŒáˆ™ áŠ¥áŠ“ á‹«áˆµáŒˆá‰¡",
];

const EN = {
  importerRequired: "Importer is required.",
  shipmentSubmittedSuccess: "Shipment submitted successfully.",
  failedSubmit: "Failed to submit shipment",
  shipmentRegistration: "Shipment Registration",
  workflowSubtitle: "Netherlands Customs style workflow (EU Single Window format)",
  stepOf: "Step {step} of {total}",
  loadingImporters: "Loading importer registry...",
  shipmentSubmitted: "Shipment Submitted",
  shipmentId: "Shipment ID",
  shipmentReference: "Shipment Reference",
  status: "Status",
  submitted: "Submitted",
  statusTracking: "Shipment Status Tracking",
  shipmentRef: "Shipment Ref",
  completed: "Completed",
  inspection: "Inspection",
  pending: "Pending",
  payment: "Payment",
  notRequiredYet: "Not Required Yet",
  cleared: "Cleared",
  awaiting: "Awaiting",
  downloadSummary: "Download Summary (PDF)",
  registerAnother: "Register Another Shipment",
};

const AM = {
  importerRequired: "áŠ áˆµáˆ˜áŒª áˆ˜áˆáˆ¨áŒ¥ áŠ áˆµáˆáˆ‹áŒŠ áŠá‹á¢",
  shipmentSubmittedSuccess: "áŒ­áŠá‰± á‰ á‰°áˆ³áŠ« áˆáŠ”á‰³ á‰°áˆáŠ³áˆá¢",
  failedSubmit: "áŒ­áŠá‰±áŠ• áˆ›áˆµáŒˆá‰£á‰µ áŠ áˆá‰°áˆ³áŠ«áˆ",
  shipmentRegistration: "á‹¨áŒ­áŠá‰µ áˆá‹áŒˆá‰£",
  workflowSubtitle: "á‰ áŠ”á‹˜áˆ­áˆ‹áŠ•á‹µ áŒ‰áˆáˆ©áŠ­ á‹˜á‹´ á‹¨á‰°á‰€áˆ¨áŒ¸ á‹¨áˆµáˆ« ááˆ°á‰µ (EU Single Window)",
  stepOf: "á‹°áˆ¨áŒƒ {step} áŠ¨ {total}",
  loadingImporters: "á‹¨áŠ áˆµáˆ˜áŒª áˆ˜á‹áŒˆá‰¥ á‰ áˆ˜áŒ«áŠ• áˆ‹á‹­...",
  shipmentSubmitted: "áŒ­áŠá‰µ á‰°áˆáŠ³áˆ",
  shipmentId: "á‹¨áŒ­áŠá‰µ áˆ˜áˆˆá‹«",
  shipmentReference: "á‹¨áŒ­áŠá‰µ áˆ›áŒ£á‰€áˆ»",
  status: "áˆáŠ”á‰³",
  submitted: "á‰°áˆáŠ³áˆ",
  statusTracking: "á‹¨áŒ­áŠá‰µ áˆáŠ”á‰³ áŠ­á‰µá‰µáˆ",
  shipmentRef: "á‹¨áŒ­áŠá‰µ áˆ›áŒ£á‰€áˆ»",
  completed: "á‰°áŒ áŠ“á‰‹áˆ",
  inspection: "áˆáˆ­áˆ˜áˆ«",
  pending: "á‰ áˆ˜áŒ á‰£á‰ á‰… áˆ‹á‹­",
  payment: "áŠ­áá‹«",
  notRequiredYet: "áŠ áˆáŠ• áŠ á‹«áˆµáˆáˆáŒáˆ",
  cleared: "á‰°áˆá‰…á‹·áˆ",
  awaiting: "á‰ áˆ˜áŒ á‰£á‰ á‰… áˆ‹á‹­",
  downloadSummary: "áˆ›áŒ á‰ƒáˆˆá‹« áŠ á‹áˆ­á‹µ (PDF)",
  registerAnother: "áˆŒáˆ‹ áŒ­áŠá‰µ áˆ˜á‹áŒá‰¥",
};






