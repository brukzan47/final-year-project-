import React from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";

const TRANSPORT = ["Sea", "Air", "Road", "Rail", "Multimodal"];
const PORT_OF_LOADING_OPTIONS = [
  "Shanghai",
  "Ningbo",
  "Shenzhen",
  "Jebel Ali",
  "Mersin",
  "Hamburg",
  "Mumbai",
  "Mombasa",
  "Djibouti",
];
const PORT_OF_ENTRY_OPTIONS = [
  "Djibouti Port",
  "Modjo Dry Port",
  "Kality Dry Port",
  "Dire Dawa Dry Port",
  "Moyale Border",
  "Metema Border",
  "Galafi Border",
];
const OTHER_VALUE = "__OTHER__";

function normalizeContainer(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidContainer(v) {
  const code = normalizeContainer(v);
  if (!/^[A-Z]{4}\d{7}$/.test(code)) return false;
  const map = { A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38 };
  const weights = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = code[i];
    const val = i < 4 ? map[ch] : Number(ch);
    sum += val * weights[i];
  }
  const check = (sum % 11) % 10;
  return check === Number(code[10]);
}

function isContainerStructure(v) {
  return /^[A-Z]{4}\d{7}$/.test(normalizeContainer(v));
}

function isValidAwb(v) {
  return /^\d{3}-?\d{8}$/.test(String(v || "").trim());
}

function isValidBl(v) {
  // Allow common BL references with mixed letters/numbers and separators.
  return /^[A-Z0-9][A-Z0-9\-\/]{5,30}$/.test(String(v || "").toUpperCase().replace(/\s/g, ""));
}

export default function ShipmentStep3Transport({ data, onChange, next, prev }) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const local = data || {};
  const containerRaw = local.container_no || "";
  const blRaw = local.bill_of_lading || "";

  const containerStructureOk = !containerRaw || isContainerStructure(containerRaw);
  const containerCheckOk = !containerRaw || isValidContainer(containerRaw);
  const containerOk = containerStructureOk;
  const docRefOk = !blRaw || isValidAwb(blRaw) || isValidBl(blRaw);

  const canProceed = Boolean(
    local.mode_of_transport &&
    local.port_of_loading &&
    local.destination_port &&
    local.arrival_date &&
    containerOk &&
    docRefOk
  );

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      <div className="eu-grid two">
        <label className="eu-field">
          <span>{t.mode}</span>
          <select
            value={local.mode_of_transport || ""}
            onChange={(e) => onChange({ mode_of_transport: e.target.value })}
          >
            <option value="">{t.selectMode}</option>
            {TRANSPORT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="eu-field">
          <span>{t.portLoading}</span>
          <select
            value={PORT_OF_LOADING_OPTIONS.includes(local.port_of_loading) ? local.port_of_loading : (local.port_of_loading ? OTHER_VALUE : "")}
            onChange={(e) => onChange({ port_of_loading: e.target.value === OTHER_VALUE ? "" : e.target.value })}
          >
            <option value="">{t.selectPortLoading || "Select port of loading..."}</option>
            {PORT_OF_LOADING_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={OTHER_VALUE}>{t.other || "Other (type manually)"}</option>
          </select>
          {(local.port_of_loading && !PORT_OF_LOADING_OPTIONS.includes(local.port_of_loading)) && (
            <input
              value={local.port_of_loading}
              onChange={(e) => onChange({ port_of_loading: e.target.value })}
              placeholder={t.typePortLoading || "Type port of loading"}
            />
          )}
        </label>

        <label className="eu-field">
          <span>{t.portEntry}</span>
          <select
            value={PORT_OF_ENTRY_OPTIONS.includes(local.destination_port) ? local.destination_port : (local.destination_port ? OTHER_VALUE : "")}
            onChange={(e) => onChange({ destination_port: e.target.value === OTHER_VALUE ? "" : e.target.value })}
          >
            <option value="">{t.selectPortEntry || "Select port of entry..."}</option>
            {PORT_OF_ENTRY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={OTHER_VALUE}>{t.other || "Other (type manually)"}</option>
          </select>
          {(local.destination_port && !PORT_OF_ENTRY_OPTIONS.includes(local.destination_port)) && (
            <input
              value={local.destination_port}
              onChange={(e) => onChange({ destination_port: e.target.value })}
              placeholder={t.typePortEntry || "Type port of entry"}
            />
          )}
        </label>

        <label className="eu-field">
          <span>{t.containerNo}</span>
          <input
            value={local.container_no || ""}
            onChange={(e) => onChange({ container_no: e.target.value.toUpperCase() })}
            placeholder="MSKU1234567"
          />
          {containerRaw ? (
            <small className={containerOk ? "ok" : "err"}>
              {containerOk ? (
                containerCheckOk
                  ? t.containerValid
                  : t.containerStructureOnly
              ) : t.containerInvalid}
            </small>
          ) : (
            <small>{t.containerOptional}</small>
          )}
        </label>

        <label className="eu-field">
          <span>{t.blAwb}</span>
          <input
            value={local.bill_of_lading || ""}
            onChange={(e) => onChange({ bill_of_lading: e.target.value.toUpperCase() })}
            placeholder={t.blAwbPh}
          />
          {blRaw ? (
            <small className={docRefOk ? "ok" : "err"}>
              {docRefOk ? t.refValid : t.refInvalid}
            </small>
          ) : (
            <small>{t.refRecommended}</small>
          )}
        </label>

        <label className="eu-field">
          <span>{t.arrivalDate}</span>
          <input
            type="date"
            value={local.arrival_date || ""}
            onChange={(e) => onChange({ arrival_date: e.target.value })}
          />
        </label>
      </div>

      <div className="eu-nav">
        <button className="eu-btn" onClick={prev}>{t.back}</button>
        <button className="eu-btn primary" onClick={next} disabled={!canProceed}>{t.next}</button>
      </div>
    </div>
  );
}

const EN = {
  stepTitle: "Step 3: Transport Routing",
  stepHelp: "Capture carriage, routing, and reference identifiers used for customs risk control.",
  mode: "Mode of Transport",
  selectMode: "Select mode...",
  portLoading: "Port of Loading",
  selectPortLoading: "Select port of loading...",
  portEntry: "Port of Entry",
  selectPortEntry: "Select port of entry...",
  other: "Other (type manually)",
  typePortLoading: "Type port of loading",
  typePortEntry: "Type port of entry",
  containerNo: "Container Number",
  containerValid: "ISO 6346 container format valid",
  containerStructureOnly: "Container structure valid (check digit not verified)",
  containerInvalid: "Invalid container format (expected 4 letters + 7 digits)",
  containerOptional: "Optional for non-container shipments",
  blAwb: "Bill of Lading / AWB",
  blAwbPh: "BL/AWB reference",
  refValid: "Reference format valid (BL/AWB)",
  refInvalid: "Invalid BL/AWB format",
  refRecommended: "Recommended for traceability",
  arrivalDate: "Estimated Arrival Date",
  back: "Back",
  next: "Next",
};

const AM = {
  stepTitle: "ደረጃ 3: የትራንስፖርት መንገድ",
  stepHelp: "ለጉምሩክ የአደጋ ቁጥጥር የሚያገለግሉ የጭነት እና የመንገድ መረጃዎችን ያስገቡ።",
  mode: "የትራንስፖርት አይነት",
  selectMode: "አይነት ይምረጡ...",
  portLoading: "የመጫኛ ወደብ",
  portEntry: "የመግቢያ ወደብ",
  containerNo: "የኮንቴነር ቁጥር",
  containerValid: "የISO 6346 ኮንቴነር ቅርጸት ትክክል ነው",
  containerStructureOnly: "የኮንቴነር አቀራረብ ትክክል ነው (check digit አልተረጋገጠም)",
  containerInvalid: "የኮንቴነር ቅርጸት ስህተት ነው (4 ፊደል + 7 አሃዝ)",
  containerOptional: "ለኮንቴነር ያልሆነ ጭነት አማራጭ ነው",
  blAwb: "Bill of Lading / AWB",
  blAwbPh: "BL/AWB ማጣቀሻ",
  refValid: "የማጣቀሻ ቅርጸት ትክክል ነው (BL/AWB)",
  refInvalid: "የBL/AWB ቅርጸት ስህተት ነው",
  refRecommended: "ለመከታተያ ይመከራል",
  arrivalDate: "የሚጠበቀው የመድረሻ ቀን",
  back: "ተመለስ",
  next: "ቀጣይ",
};
