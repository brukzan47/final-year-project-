import React, { useEffect, useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v) {
  return n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ShipmentStep4Value({
  data,
  onChange,
  next,
  prev,
  suggestedDutyRate,
  suggestedVatRate,
  suggestedSource,
}) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const local = data || {};

  useEffect(() => {
    const updates = {};
    if ((local.tariff_rate === "" || local.tariff_rate == null) && suggestedDutyRate != null && suggestedDutyRate !== "") {
      updates.tariff_rate = suggestedDutyRate;
    }
    if ((local.vat_rate === "" || local.vat_rate == null) && suggestedVatRate != null && suggestedVatRate !== "") {
      updates.vat_rate = suggestedVatRate;
    }
    if (Object.keys(updates).length > 0) {
      onChange({ ...updates, tariff_source: suggestedSource || "taric" });
    }
  }, [local.tariff_rate, local.vat_rate, suggestedDutyRate, suggestedVatRate, suggestedSource, onChange]);

  const cifUsd = n(local.cif_value_usd);
  const rate = n(local.exchange_rate || 130);
  const tariff = n(local.tariff_rate || 0);
  const vatRate = n(local.vat_rate || 0);

  const preview = useMemo(() => {
    const cifEtb = cifUsd * rate;
    const duty = cifEtb * (tariff / 100);
    const vat = (cifEtb + duty) * (vatRate / 100);
    const total = cifEtb + duty + vat;
    return { cifEtb, duty, vat, total };
  }, [cifUsd, rate, tariff, vatRate]);

  const canProceed = cifUsd > 0 && rate > 0;

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      <div className="eu-grid two">
        <label className="eu-field">
          <span>{t.invoice}</span>
          <input
            type="number"
            value={local.invoice_value_usd || ""}
            onChange={(e) => onChange({ invoice_value_usd: e.target.value })}
            placeholder={t.invoicePh}
          />
        </label>

        <label className="eu-field">
          <span>{t.cif}</span>
          <input
            type="number"
            value={local.cif_value_usd || ""}
            onChange={(e) => onChange({ cif_value_usd: e.target.value })}
            placeholder={t.cifPh}
          />
        </label>

        <label className="eu-field">
          <span>{t.exchange}</span>
          <input
            type="number"
            value={local.exchange_rate || 130}
            onChange={(e) => onChange({ exchange_rate: e.target.value })}
            placeholder={t.exchangePh}
          />
        </label>

        <label className="eu-field">
          <span>{t.dutyRate}</span>
          <input
            type="number"
            value={local.tariff_rate ?? ""}
            onChange={(e) => onChange({ tariff_rate: e.target.value })}
            placeholder={t.dutyPh}
          />
        </label>

        <label className="eu-field">
          <span>{t.vatRate}</span>
          <input
            type="number"
            value={local.vat_rate ?? ""}
            onChange={(e) => onChange({ vat_rate: e.target.value })}
            placeholder={t.vatPh}
          />
        </label>
      </div>

      {(suggestedDutyRate != null || suggestedVatRate != null) && (
        <div className="eu-preview">
          <div><strong>{t.suggestedTitle}</strong></div>
          <div>{t.duty}: {suggestedDutyRate ?? "-"}%</div>
          <div>{t.vat}: {suggestedVatRate ?? "-"}%</div>
          <div>{t.source}: {suggestedSource || "taric"}</div>
          <div className="eu-nav" style={{ justifyContent: "flex-start", marginTop: 8 }}>
            <button
              type="button"
              className="eu-btn"
              onClick={() => onChange({
                tariff_rate: suggestedDutyRate ?? local.tariff_rate,
                vat_rate: suggestedVatRate ?? local.vat_rate,
                tariff_source: suggestedSource || "taric",
              })}
            >
              {t.applySuggested}
            </button>
          </div>
        </div>
      )}

      <div className="eu-preview">
        <div><strong>{t.cifEtb}:</strong> {money(preview.cifEtb)}</div>
        <div><strong>{t.estimatedDuty}:</strong> {money(preview.duty)} ETB</div>
        <div><strong>{t.estimatedVat}:</strong> {money(preview.vat)} ETB</div>
        <div><strong>{t.totalEstimate}:</strong> {money(preview.total)} ETB</div>
      </div>

      <div className="eu-nav">
        <button className="eu-btn" onClick={prev}>{t.back}</button>
        <button className="eu-btn primary" onClick={next} disabled={!canProceed}>{t.next}</button>
      </div>
    </div>
  );
}

const EN = {
  stepTitle: "Step 4: Customs Valuation",
  stepHelp: "Compute customs duty and VAT based on CIF value and applicable tariff rates.",
  invoice: "Invoice Value (USD)",
  invoicePh: "Invoice value",
  cif: "CIF Value (USD)",
  cifPh: "CIF value",
  exchange: "Exchange Rate (ETB)",
  exchangePh: "ETB per USD",
  dutyRate: "Duty Rate (%)",
  dutyPh: "Duty rate (e.g. 30)",
  vatRate: "VAT Rate (%)",
  vatPh: "VAT rate (e.g. 15)",
  suggestedTitle: "Suggested TARIC Rates",
  duty: "Duty",
  vat: "VAT",
  source: "Source",
  applySuggested: "Apply Suggested Rates",
  cifEtb: "CIF (ETB)",
  estimatedDuty: "Estimated Duty",
  estimatedVat: "Estimated VAT",
  totalEstimate: "Total Payable Estimate",
  back: "Back",
  next: "Next",
};

const AM = {
  stepTitle: "ደረጃ 4: የጉምሩክ ዋጋ ግምት",
  stepHelp: "በCIF እና ተፈጻሚ ታሪፍ መጠን መሰረት ግብር እና VAT ያስሉ።",
  invoice: "የኢንቮይስ ዋጋ (USD)",
  invoicePh: "የኢንቮይስ ዋጋ",
  cif: "የCIF ዋጋ (USD)",
  cifPh: "የCIF ዋጋ",
  exchange: "የምንዛሬ ተመን (ETB)",
  exchangePh: "ETB በUSD",
  dutyRate: "የግብር መጠን (%)",
  dutyPh: "የግብር መጠን (ለምሳሌ 30)",
  vatRate: "የVAT መጠን (%)",
  vatPh: "የVAT መጠን (ለምሳሌ 15)",
  suggestedTitle: "የተጠቆሙ የTARIC መጠኖች",
  duty: "ግብር",
  vat: "VAT",
  source: "ምንጭ",
  applySuggested: "የተጠቆሙትን መጠኖች ተጠቀም",
  cifEtb: "CIF (ETB)",
  estimatedDuty: "የተገመተ ግብር",
  estimatedVat: "የተገመተ VAT",
  totalEstimate: "ጠቅላላ የሚከፈል ግምት",
  back: "ተመለስ",
  next: "ቀጣይ",
};
