import React, { useEffect, useMemo, useState } from "react";
import hsData from "../../data/hs-codes.json";
import { TaricAPI } from "../../api/taricAPI.js";
import { useLanguage } from "../../context/LanguageContext.jsx";

const normalize = (v) => String(v || "").replace(/\D/g, "");
const GOODS_TYPE_OPTIONS = [
  "Electronics",
  "Machinery",
  "Food",
  "Textiles",
  "Chemicals",
  "Pharmaceuticals",
  "Automotive Parts",
  "Construction Materials",
];
const COUNTRY_OPTIONS = [
  "China",
  "India",
  "United Arab Emirates",
  "Turkey",
  "Germany",
  "United States",
  "Japan",
  "South Korea",
  "Saudi Arabia",
  "Kenya",
];
const DESCRIPTION_OPTIONS = [
  "Consumer electronics and accessories",
  "Industrial machinery and spare parts",
  "Packaged food products",
  "Textile materials and garments",
  "Chemical raw materials",
  "Pharmaceutical and medical supplies",
  "Vehicle spare parts",
  "Construction and hardware supplies",
];
const OTHER_VALUE = "__OTHER__";

export default function ShipmentStep2Goods({ data, onChange, next, prev }) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const local = data || {};
  const [taricLive, setTaricLive] = useState(null);
  const [taricLoading, setTaricLoading] = useState(false);
  const [taricErr, setTaricErr] = useState("");
  const hsNormalized = normalize(local.hs_code);
  const hsValid = hsNormalized.length === 8;

  const hsMatch = useMemo(() => {
    if (!hsValid) return null;
    return hsData.find((x) => normalize(x.code) === hsNormalized) || null;
  }, [hsNormalized, hsValid]);

  const hsDesc = hsMatch?.desc || "";
  const hsFound = Boolean(hsMatch);
  const effectiveDesc = taricLive?.description || hsDesc;

  const hsSuggestions = useMemo(() => {
    if (!hsNormalized) return [];
    return hsData
      .filter((x) => normalize(x.code).startsWith(hsNormalized))
      .slice(0, 6);
  }, [hsNormalized]);

  const taric = useMemo(() => {
    if (!hsValid) return null;
    return {
      chapter: hsNormalized.slice(0, 2),
      heading: hsNormalized.slice(0, 4),
      subheading: hsNormalized.slice(0, 6),
      tariffItem: hsNormalized.slice(0, 8),
    };
  }, [hsValid, hsNormalized]);

  const canProceed = Boolean(
    hsValid &&
    (local.description || effectiveDesc) &&
    local.quantity &&
    local.goods_type &&
    local.origin_country
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTaricErr("");
      if (!hsValid) {
        setTaricLive(null);
        return;
      }
      if (!TaricAPI.isConfigured()) {
        setTaricLive(null);
        return;
      }
      setTaricLoading(true);
      try {
        const live = await TaricAPI.lookup(hsNormalized);
        if (!cancelled) {
          setTaricLive(live || null);
          onChange({
            taric_duty_rate: live?.dutyRate ?? "",
            taric_vat_rate: live?.vatRate ?? "",
            taric_source: live?.source || "taric",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setTaricLive(null);
          setTaricErr(e.message || "TARIC lookup unavailable");
          onChange({
            taric_duty_rate: "",
            taric_vat_rate: "",
            taric_source: "",
          });
        }
      } finally {
        if (!cancelled) setTaricLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [hsNormalized, hsValid]);

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      <div className="eu-grid two">
        <label className="eu-field">
          <span>{t.hsCode}</span>
          <input
            value={local.hs_code || ""}
            onChange={(e) => onChange({ hs_code: e.target.value })}
            placeholder={t.hsCodePh}
          />
          <small className={hsValid ? "ok" : "err"}>
            {hsValid ? t.hsValid : t.hsInvalid}
          </small>
          {effectiveDesc && <small className="ok">{t.matched}: {effectiveDesc}</small>}
          {hsValid && !hsFound && <small className="err">{t.noLocalMatch}</small>}
          {TaricAPI.isConfigured() && hsValid && (
            <small className={taricErr ? "err" : "ok"}>
              {taricLoading ? t.checkingTaric : taricErr ? t.taricUnavailable : t.taricActive}
            </small>
          )}
        </label>

        <label className="eu-field">
          <span>{t.goodsType}</span>
          <select
            value={GOODS_TYPE_OPTIONS.includes(local.goods_type) ? local.goods_type : (local.goods_type ? OTHER_VALUE : "")}
            onChange={(e) => onChange({ goods_type: e.target.value === OTHER_VALUE ? "" : e.target.value })}
          >
            <option value="">{t.selectGoodsType || "Select goods type..."}</option>
            {GOODS_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            <option value={OTHER_VALUE}>{t.other || "Other (type manually)"}</option>
          </select>
          {(local.goods_type && !GOODS_TYPE_OPTIONS.includes(local.goods_type)) && (
            <input
              value={local.goods_type}
              onChange={(e) => onChange({ goods_type: e.target.value })}
              placeholder={t.typeGoodsType || "Type goods type"}
            />
          )}
        </label>

        <label className="eu-field">
          <span>{t.description}</span>
          <select
            value={DESCRIPTION_OPTIONS.includes(local.description) ? local.description : (local.description ? OTHER_VALUE : "")}
            onChange={(e) => onChange({ description: e.target.value === OTHER_VALUE ? "" : e.target.value })}
          >
            <option value="">{t.selectDescription || "Select description..."}</option>
            {DESCRIPTION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            <option value={OTHER_VALUE}>{t.other || "Other (type manually)"}</option>
          </select>
          {(local.description && !DESCRIPTION_OPTIONS.includes(local.description)) && (
            <input
              value={local.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder={t.typeDescription || "Type description"}
            />
          )}
        </label>

        <label className="eu-field">
          <span>{t.origin}</span>
          <select
            value={COUNTRY_OPTIONS.includes(local.origin_country) ? local.origin_country : (local.origin_country ? OTHER_VALUE : "")}
            onChange={(e) => onChange({ origin_country: e.target.value === OTHER_VALUE ? "" : e.target.value })}
          >
            <option value="">{t.selectOrigin || "Select country of origin..."}</option>
            {COUNTRY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            <option value={OTHER_VALUE}>{t.other || "Other (type manually)"}</option>
          </select>
          {(local.origin_country && !COUNTRY_OPTIONS.includes(local.origin_country)) && (
            <input
              value={local.origin_country}
              onChange={(e) => onChange({ origin_country: e.target.value })}
              placeholder={t.typeOrigin || "Type country of origin"}
            />
          )}
        </label>

        <label className="eu-field">
          <span>{t.quantity}</span>
          <input
            type="number"
            value={local.quantity || ""}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder={t.quantity}
          />
        </label>

        <label className="eu-field">
          <span>{t.uom}</span>
          <input
            value={local.unit_of_measure || ""}
            onChange={(e) => onChange({ unit_of_measure: e.target.value })}
            placeholder={t.uomPh}
          />
        </label>

        <label className="eu-field">
          <span>{t.netWeight}</span>
          <input
            type="number"
            value={local.net_weight_kg || ""}
            onChange={(e) => onChange({ net_weight_kg: e.target.value })}
            placeholder={t.netWeightPh}
          />
        </label>

        <label className="eu-field">
          <span>{t.grossWeight}</span>
          <input
            type="number"
            value={local.gross_weight_kg || ""}
            onChange={(e) => onChange({ gross_weight_kg: e.target.value })}
            placeholder={t.grossWeightPh}
          />
        </label>
      </div>

      {taric && (
        <div className="eu-preview">
          <div><strong>{t.taricBreakdown}</strong></div>
          <div>{t.chapter}: {taric.chapter}</div>
          <div>{t.heading}: {taric.heading}</div>
          <div>{t.subheading}: {taric.subheading}</div>
          <div>{t.tariffItem}: {taric.tariffItem}</div>
          <div>{t.lookup}: {taricLive ? t.liveMatched : hsFound ? t.localMatched : t.noLocalShort}</div>
          {taricLive?.dutyRate != null && <div>{t.liveDuty}: {taricLive.dutyRate}%</div>}
          {taricLive?.vatRate != null && <div>{t.liveVat}: {taricLive.vatRate}%</div>}
        </div>
      )}

      {!hsFound && hsSuggestions.length > 0 && (
        <div className="eu-preview">
          <div><strong>{t.closestSuggestions}</strong></div>
          {hsSuggestions.map((s) => (
            <div key={s.code} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{s.code}</span>
              <button className="eu-btn" type="button" onClick={() => onChange({ hs_code: s.code })}>{t.use}</button>
            </div>
          ))}
        </div>
      )}

      <div className="eu-nav">
        <button className="eu-btn" onClick={prev}>{t.back}</button>
        <button className="eu-btn primary" onClick={next} disabled={!canProceed}>{t.next}</button>
      </div>
    </div>
  );
}

const EN = {
  stepTitle: "Step 2: Goods Classification",
  stepHelp: "Provide commodity coding, origin, and quantity information (EU TARIC structure).",
  hsCode: "HS Code (8 digits)",
  hsCodePh: "e.g. 85044010",
  hsValid: "HS format valid",
  hsInvalid: "HS code must be 8 digits",
  matched: "Matched",
  noLocalMatch: "No exact local TARIC match found. Verify code manually.",
  checkingTaric: "Checking live TARIC...",
  taricUnavailable: "Live TARIC unavailable, using local HS data",
  taricActive: "Live TARIC lookup active",
  goodsType: "Goods Type",
  selectGoodsType: "Select goods type...",
  goodsTypePh: "Electronics / Machinery / Food...",
  description: "Description",
  selectDescription: "Select description...",
  descriptionPh: "Goods description",
  origin: "Country of Origin",
  selectOrigin: "Select country of origin...",
  other: "Other (type manually)",
  typeGoodsType: "Type goods type",
  typeDescription: "Type description",
  typeOrigin: "Type country of origin",
  originPh: "Country of origin",
  quantity: "Quantity",
  uom: "Unit of Measure",
  uomPh: "pcs / kg / box",
  netWeight: "Net Weight (kg)",
  netWeightPh: "Net weight",
  grossWeight: "Gross Weight (kg)",
  grossWeightPh: "Gross weight",
  taricBreakdown: "TARIC Breakdown",
  chapter: "Chapter",
  heading: "Heading",
  subheading: "Subheading",
  tariffItem: "Tariff Item",
  lookup: "Lookup",
  liveMatched: "Matched live TARIC service",
  localMatched: "Matched local HS registry",
  noLocalShort: "No exact local match",
  liveDuty: "Live Duty Rate",
  liveVat: "Live VAT Rate",
  closestSuggestions: "Closest HS Suggestions",
  use: "Use",
  back: "Back",
  next: "Next",
};

const AM = {
  stepTitle: "ደረጃ 2: የእቃ መደበኛ ኮድ",
  stepHelp: "የእቃ ኮድ፣ መነሻ አገር እና መጠን መረጃ ያስገቡ (EU TARIC).",
  hsCode: "HS ኮድ (8 አሃዝ)",
  hsCodePh: "ለምሳሌ 85044010",
  hsValid: "የHS ቅርጸት ትክክል ነው",
  hsInvalid: "HS ኮድ 8 አሃዝ መሆን አለበት",
  matched: "ተዛመደ",
  noLocalMatch: "ትክክለኛ የአካባቢ TARIC ተዛማጅ አልተገኘም። በእጅ ያረጋግጡ።",
  checkingTaric: "የቀጥታ TARIC ምርመራ በመካሄድ ላይ...",
  taricUnavailable: "የቀጥታ TARIC አይገኝም፣ የአካባቢ HS መረጃ እየተጠቀሙ ነው",
  taricActive: "የቀጥታ TARIC ምርመራ ነቅቷል",
  goodsType: "የእቃ አይነት",
  goodsTypePh: "ኤሌክትሮኒክስ / ማሽነሪ / ምግብ...",
  description: "መግለጫ",
  descriptionPh: "የእቃ መግለጫ",
  origin: "የመነሻ አገር",
  originPh: "የመነሻ አገር",
  quantity: "መጠን",
  uom: "የመለኪያ ክፍል",
  uomPh: "pcs / kg / box",
  netWeight: "የተጣራ ክብደት (kg)",
  netWeightPh: "የተጣራ ክብደት",
  grossWeight: "ጠቅላላ ክብደት (kg)",
  grossWeightPh: "ጠቅላላ ክብደት",
  taricBreakdown: "የTARIC ዝርዝር",
  chapter: "ምዕራፍ",
  heading: "ርዕስ",
  subheading: "ንዑስ ርዕስ",
  tariffItem: "የታሪፍ ንጥል",
  lookup: "ምርመራ",
  liveMatched: "ከቀጥታ TARIC አገልግሎት ጋር ተዛመደ",
  localMatched: "ከአካባቢ HS መዝገብ ጋር ተዛመደ",
  noLocalShort: "ትክክለኛ የአካባቢ ተዛማጅ የለም",
  liveDuty: "የቀጥታ የግብር መጠን",
  liveVat: "የቀጥታ VAT መጠን",
  closestSuggestions: "ቀረበ የHS ጥቆማዎች",
  use: "ተጠቀም",
  back: "ተመለስ",
  next: "ቀጣይ",
};
