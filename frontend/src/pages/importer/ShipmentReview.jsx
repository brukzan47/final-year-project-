import React from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";

function row(label, value) {
  return (
    <div className="eu-review-row" key={label}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

export default function ShipmentReview({ data, prev, submit, submitting, error, downloadSummary }) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const d = data || {};
  const files = Array.isArray(d.documents?.files) ? d.documents.files : [];
  const sourceRaw = String(d.value?.tariff_source || "").toLowerCase();
  const sourceLabel = sourceRaw.includes("taric") ? t.taricLive : t.manualEntry;
  const sourceStyle = sourceRaw.includes("taric")
    ? { background: "#e6ffed", color: "#137333" }
    : { background: "rgba(125, 166, 217, 0.16)", color: "#374151" };
  const timeline = [
    { key: t.submitted, status: t.completed },
    { key: t.inspection, status: t.pending },
    { key: t.payment, status: t.notRequiredYet },
    { key: t.cleared, status: t.awaiting },
  ];

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      <div className="eu-review">
        {row(t.importerId, d.operator?.importer_id)}
        {row(t.hsCode, d.goods?.hs_code)}
        {row(t.description, d.goods?.description)}
        {row(t.origin, d.goods?.origin_country)}
        {row(t.quantity, d.goods?.quantity)}
        {row(t.mode, d.transport?.mode_of_transport)}
        {row(t.portLoading, d.transport?.port_of_loading)}
        {row(t.portEntry, d.transport?.destination_port)}
        {row(t.containerNo, d.transport?.container_no)}
        {row(t.blAwb, d.transport?.bill_of_lading)}
        {row(t.cifUsd, d.value?.cif_value_usd)}
        {row(t.dutyRate, d.value?.tariff_rate)}
        <div className="eu-review-row">
          <span>{t.ratesSource}</span>
          <strong>
            <span style={{ ...sourceStyle, borderRadius: 999, fontSize: 11, padding: "3px 8px" }}>
              {sourceLabel}
            </span>
          </strong>
        </div>
        {row(t.documentsAttached, String(files.length || 0))}
      </div>

      <div className="eu-status-panel">
        <h4>{t.statusTracking}</h4>
        <div className="eu-status-id">{t.shipmentRef}: {d.generatedRef || t.pendingGeneration}</div>
        <div className="eu-timeline">
          {timeline.map((t) => (
            <div key={t.key} className="eu-timeline-item">
              <span>{t.key}</span>
              <span>{t.status}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="err">{error}</div>}
      <div className="eu-nav">
        <button className="eu-btn" onClick={prev}>{t.back}</button>
        <button className="eu-btn" type="button" onClick={downloadSummary}>{t.downloadPdf}</button>
        <button className="eu-btn primary" onClick={submit} disabled={submitting}>
          {submitting ? t.submitting : t.submitShipment}
        </button>
      </div>
    </div>
  );
}

const EN = {
  stepTitle: "Step 6: Review & Submit",
  stepHelp: "Confirm all declaration data and submit to customs processing.",
  importerId: "Importer ID",
  hsCode: "HS Code",
  description: "Description",
  origin: "Origin",
  quantity: "Quantity",
  mode: "Mode of Transport",
  portLoading: "Port of Loading",
  portEntry: "Port of Entry",
  containerNo: "Container No.",
  blAwb: "B/L or AWB",
  cifUsd: "CIF Value (USD)",
  dutyRate: "Duty Rate (%)",
  ratesSource: "Rates Source",
  documentsAttached: "Documents Attached",
  statusTracking: "Shipment Status Tracking",
  shipmentRef: "Shipment Ref",
  pendingGeneration: "Pending generation",
  back: "Back",
  downloadPdf: "Download Summary (PDF)",
  submitting: "Submitting...",
  submitShipment: "Submit Shipment",
  taricLive: "TARIC Live",
  manualEntry: "Manual Entry",
  submitted: "Submitted",
  completed: "Completed",
  inspection: "Inspection",
  pending: "Pending",
  payment: "Payment",
  notRequiredYet: "Not Required Yet",
  cleared: "Cleared",
  awaiting: "Awaiting",
};

const AM = {
  stepTitle: "á‹°áˆ¨áŒƒ 6: á‹­áŒˆáˆáŒáˆ™ áŠ¥áŠ“ á‹«áˆµáŒˆá‰¡",
  stepHelp: "áˆáˆ‰áŠ•áˆ á‹¨áˆ˜áŒáˆˆáŒ« áˆ˜áˆ¨áŒƒ á‹«áˆ¨áŒ‹áŒáŒ¡ áŠ¥áŠ“ á‹ˆá‹° áŒ‰áˆáˆ©áŠ­ áˆ‚á‹°á‰µ á‹«áˆµáŒˆá‰¡á¢",
  importerId: "á‹¨áŠ áˆµáˆ˜áŒª áˆ˜áˆˆá‹«",
  hsCode: "HS áŠ®á‹µ",
  description: "áˆ˜áŒáˆˆáŒ«",
  origin: "áˆ˜áŠáˆ»",
  quantity: "áˆ˜áŒ áŠ•",
  mode: "á‹¨á‰µáˆ«áŠ•áˆµá–áˆ­á‰µ áŠ á‹­áŠá‰µ",
  portLoading: "á‹¨áˆ˜áŒ«áŠ› á‹ˆá‹°á‰¥",
  portEntry: "á‹¨áˆ˜áŒá‰¢á‹« á‹ˆá‹°á‰¥",
  containerNo: "á‹¨áŠ®áŠ•á‰´áŠáˆ­ á‰áŒ¥áˆ­",
  blAwb: "B/L á‹ˆá‹­áˆ AWB",
  cifUsd: "á‹¨CIF á‹‹áŒ‹ (USD)",
  dutyRate: "á‹¨áŒá‰¥áˆ­ áˆ˜áŒ áŠ• (%)",
  ratesSource: "á‹¨áˆ˜áŒ áŠ• áˆáŠ•áŒ­",
  documentsAttached: "á‹¨á‰°á‹«á‹«á‹™ áˆ°áŠá‹¶á‰½",
  statusTracking: "á‹¨áŒ­áŠá‰µ áˆáŠ”á‰³ áŠ­á‰µá‰µáˆ",
  shipmentRef: "á‹¨áŒ­áŠá‰µ áˆ›áŒ£á‰€áˆ»",
  pendingGeneration: "á‰ áˆ˜ááŒ áˆ­ áˆ‹á‹­",
  back: "á‰°áˆ˜áˆˆáˆµ",
  downloadPdf: "áˆ›áŒ á‰ƒáˆˆá‹« áŠ á‹áˆ­á‹µ (PDF)",
  submitting: "á‰ áˆ›áˆµáŒˆá‰£á‰µ áˆ‹á‹­...",
  submitShipment: "áŒ­áŠá‰µ áŠ áˆµáŒˆá‰£",
  taricLive: "á‹¨á‰€áŒ¥á‰³ TARIC",
  manualEntry: "á‰ áŠ¥áŒ… áŒá‰¤á‰µ",
  submitted: "á‰°áˆáŠ³áˆ",
  completed: "á‰°áŒ áŠ“á‰‹áˆ",
  inspection: "áˆáˆ­áˆ˜áˆ«",
  pending: "á‰ áˆ˜áŒ á‰£á‰ á‰… áˆ‹á‹­",
  payment: "áŠ­áá‹«",
  notRequiredYet: "áŠ áˆáŠ• áŠ á‹«áˆµáˆáˆáŒáˆ",
  cleared: "á‰°áˆá‰…á‹·áˆ",
  awaiting: "á‰ áˆ˜áŒ á‰£á‰ á‰… áˆ‹á‹­",
};


