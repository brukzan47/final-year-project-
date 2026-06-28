import React from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function ShipmentStep1Operator({ data, onChange, next, role, importerId, importers }) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const local = data || {};

  const canProceed = role === "Importer"
    ? Boolean(importerId || local.importer_id)
    : Boolean(local.importer_id);

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      {role === "Importer" ? (
        <>
          <label className="eu-field">
            <span>{t.importerLinked}</span>
            <input
              value={importerId || local.importer_id || ""}
              readOnly
              placeholder={t.importerLinkedPh}
            />
          </label>
          {!importerId && (
            <div className="eu-help" style={{ marginTop: -4 }}>
              {t.profileRequired}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="eu-btn"
                  onClick={() => { window.location.href = "/importers"; }}
                >
                  {t.goRegisterImporter}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <label className="eu-field">
          <span>{t.importer}</span>
          <select
            value={local.importer_id || ""}
            onChange={(e) => onChange({ importer_id: e.target.value })}
          >
            <option value="">{t.selectImporter}</option>
            {importers.map((imp) => (
              <option key={imp.importer_id} value={imp.importer_id}>
                {imp.company_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="eu-field">
        <span>{t.operatorRef}</span>
        <input
          value={local.operator_ref || ""}
          onChange={(e) => onChange({ operator_ref: e.target.value })}
          placeholder={t.operatorRefPh}
        />
      </label>

      <div className="eu-nav">
        <button className="eu-btn primary" onClick={next} disabled={!canProceed}>
          {t.next}
        </button>
      </div>
    </div>
  );
}

const EN = {
  stepTitle: "Step 1: Importer",
  stepHelp: "Identify the declarant importer responsible for this consignment.",
  importerLinked: "Importer (linked account)",
  importerLinkedPh: "Importer profile linked to your account",
  profileRequired: "Create your importer profile first before shipment registration.",
  goRegisterImporter: "Register Importer Profile",
  importer: "Importer",
  selectImporter: "Select importer...",
  operatorRef: "Operator Reference (optional)",
  operatorRefPh: "EORI / Internal operator code",
  next: "Next",
};

const AM = {
  stepTitle: "Step 1: Importer",
  stepHelp: "Create importer profile before shipment registration.",
  importerLinked: "Importer (linked account)",
  importerLinkedPh: "Importer profile linked to your account",
  profileRequired: "Create your importer profile first before shipment registration.",
  goRegisterImporter: "Register Importer Profile",
  importer: "Importer",
  selectImporter: "Select importer...",
  operatorRef: "Operator Reference (optional)",
  operatorRefPh: "EORI / Internal operator code",
  next: "Next",
};
