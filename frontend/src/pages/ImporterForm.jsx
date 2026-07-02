import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import Modal from "../components/Modal.jsx";
import { ImportersAPI } from "../api/importerAPI.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SandboxPanel from "../components/SandboxPanel.jsx";

const ADDRESS_OPTIONS = [
  "Kirkos Sub-city, Addis Ababa, Ethiopia",
  "Bole Sub-city, Addis Ababa, Ethiopia",
  "Nifas Silk-Lafto Sub-city, Addis Ababa, Ethiopia",
  "Akaki Kality Sub-city, Addis Ababa, Ethiopia",
  "Adama, Oromia, Ethiopia",
  "Dire Dawa, Ethiopia",
];
const OTHER_VALUE = "__OTHER__";

export default function ImporterForm() {
  const navigate = useNavigate();
  const { role, importerId } = useAuth();
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const [f, set] = useState({
    company_name: "",
    tin_number: "",
    customs_registration_no: "",
    contact_person: "",
    contact_title: "",
    contact_phone: "",
    contact_email: "",
    import_license_no: "",
    sector_type: "",
    address: "",
  });
  const on = (e) => set({ ...f, [e.target.name]: e.target.value });
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [selectedImporter, setSelectedImporter] = useState(null);
  const alreadyRegistered = role === "Importer" && Boolean(importerId);

  const contactTitleOptions = [
    "Manager", "Director", "Owner", "Accountant", "Agent", "CEO", "CFO", "COO", "Representative", "Other",
  ];
  const sectorTypeOptions = [
    "Manufacturing", "Trading", "Agriculture", "Services", "Construction", "Mining", "Logistics", "NGO", "Government", "Other",
  ];

  const load = async () => {
    try {
      setErr("");
      setInfo("");
      const data = await ImportersAPI.list();
      setItems(data || []);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (alreadyRegistered) {
      setInfo(t.alreadyRegisteredLocked);
      setRegistrationCompleted(true);
    }
  }, [alreadyRegistered, t.alreadyRegisteredLocked]);

  const submit = async (e) => {
    if (alreadyRegistered || registrationCompleted) return;
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    if (!f.company_name) {
      setErr(t.companyRequired);
      setLoading(false);
      return;
    }
    if (!/^\d{7,15}$/.test(f.tin_number || "")) {
      setErr(t.tinInvalid);
      setLoading(false);
      return;
    }
    if (f.contact_email && !/.+@.+\..+/.test(f.contact_email)) {
      setErr(t.emailInvalid);
      setLoading(false);
      return;
    }
    try {
      await ImportersAPI.create(f);
      set({
        company_name: "",
        tin_number: "",
        customs_registration_no: "",
        contact_person: "",
        contact_title: "",
        contact_phone: "",
        contact_email: "",
        import_license_no: "",
        sector_type: "",
        address: "",
      });
      await load();
      setRegistrationCompleted(true);
      setInfo(t.savedRedirecting);
      setTimeout(() => navigate("/shipments"), 1000);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("already registered")) {
        setRegistrationCompleted(true);
        setInfo(t.alreadyRegisteredRedirecting);
        setTimeout(() => navigate("/shipments"), 1000);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="importer-page">
      <h2 className="importer-page-title">{t.importers}</h2>
      <div className="importer-register-sandbox">
        <SandboxPanel
          kicker=""
          title={t.registerImporter}
          chips={[t.companyName, t.tinNumber, t.customsRegNo]}
        >
          <form onSubmit={submit} className="importer-register-form" style={{ display: "grid", gap: 10 }}>
            <FormField label={t.companyName} name="company_name" value={f.company_name} onChange={on} placeholder="ABC Imports PLC" />
            <FormField label={t.tinNumber} name="tin_number" value={f.tin_number} onChange={on} placeholder="0001234567" />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.customsRegNo}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  name="customs_registration_no"
                  value={f.customs_registration_no}
                  onChange={on}
                  placeholder="CRN-YYYY-XXXX"
                  pattern="CRN-\d{4}-\d{4,}"
                  title={t.crnFormatTitle}
                  style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const rand = Math.floor(Math.random() * 10000)
                      .toString()
                      .padStart(4, "0");
                    set((prev) => ({ ...prev, customs_registration_no: `CRN-${y}-${rand}` }));
                  }}
                >
                  {t.auto}
                </button>
              </div>
            </label>

            <FormField label={t.contactPerson} name="contact_person" value={f.contact_person} onChange={on} placeholder="Abebe Kebede" />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.contactTitle}</span>
              <select name="contact_title" value={f.contact_title} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                <option value="">{t.selectTitle}</option>
                {contactTitleOptions.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>

            <FormField label={t.contactPhone} name="contact_phone" value={f.contact_phone} onChange={on} placeholder="+251-911-000000" />
            <FormField label={t.contactEmail} type="email" name="contact_email" value={f.contact_email} onChange={on} placeholder="contact@abcimports.et" />
            <FormField label={t.importLicenseNo} name="import_license_no" value={f.import_license_no} onChange={on} placeholder="LIC-789456" />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.sectorType}</span>
              <select name="sector_type" value={f.sector_type} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}>
                <option value="">{t.selectSector}</option>
                {sectorTypeOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.address}</span>
              <select
                name="address"
                value={ADDRESS_OPTIONS.includes(f.address) ? f.address : (f.address ? OTHER_VALUE : "")}
                onChange={(e) => set((prev) => ({ ...prev, address: e.target.value === OTHER_VALUE ? "" : e.target.value }))}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}
              >
                <option value="">Select address...</option>
                {ADDRESS_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
                <option value={OTHER_VALUE}>Other (type manually)</option>
              </select>
              {f.address && !ADDRESS_OPTIONS.includes(f.address) && (
                <textarea
                  name="address"
                  value={f.address}
                  onChange={on}
                  placeholder="Type address"
                  style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }}
                />
              )}
            </label>

            {err && <div style={{ color: "#b00020" }}>{err}</div>}
            {info && <div style={{ color: "#0b6e2e" }}>{info}</div>}

            {!registrationCompleted && (
              <button type="submit" disabled={loading || alreadyRegistered} style={{ width: 160 }}>
                {loading ? t.saving : t.saveImporter}
              </button>
            )}
          </form>
        </SandboxPanel>
      </div>

      <section className="importer-records-panel" aria-label={t.importers}>
        <h3>{t.importers}</h3>
        <div className="importer-records-table-wrap">
        <table className="smart-table smart-table--stack importer-records-table">
          <thead>
            <tr>
              <th>{t.company}</th><th>TIN</th><th>{t.contact}</th><th>{t.phone}</th><th>{t.email}</th><th>{t.sector}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.importer_id || i.tin_number}>
                <td>
                  <button
                    type="button"
                    onClick={() => setSelectedImporter(i)}
                    style={{ padding: 0, border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {i.company_name}
                  </button>
                </td>
                <td>{i.tin_number}</td>
                <td>{i.contact_person}</td>
                <td>{i.contact_phone}</td>
                <td>{i.contact_email}</td>
                <td>{i.sector_type}</td>
              </tr>
            ))}
            {items.length === 0 && (<tr><td colSpan="6">{t.noRecords}</td></tr>)}
          </tbody>
        </table>
        </div>
      </section>

      <Modal open={!!selectedImporter} title={t.importerDetails} onClose={() => setSelectedImporter(null)}>
        {selectedImporter && (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>{t.companyName}:</strong> {selectedImporter.company_name || "-"}</div>
            <div><strong>{t.tinNumber}:</strong> {selectedImporter.tin_number || "-"}</div>
            <div><strong>{t.customsRegNo}:</strong> {selectedImporter.customs_registration_no || "-"}</div>
            <div><strong>{t.contactPerson}:</strong> {selectedImporter.contact_person || "-"}</div>
            <div><strong>{t.contactTitle}:</strong> {selectedImporter.contact_title || "-"}</div>
            <div><strong>{t.contactPhone}:</strong> {selectedImporter.contact_phone || "-"}</div>
            <div><strong>{t.contactEmail}:</strong> {selectedImporter.contact_email || "-"}</div>
            <div><strong>{t.importLicenseNo}:</strong> {selectedImporter.import_license_no || "-"}</div>
            <div><strong>{t.sectorType}:</strong> {selectedImporter.sector_type || "-"}</div>
            <div><strong>{t.address}:</strong> {selectedImporter.address || "-"}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const EN = {
  importers: "Importers",
  registerImporter: "Register Importer",
  companyName: "Company Name",
  tinNumber: "TIN Number",
  customsRegNo: "Customs Registration No",
  crnFormatTitle: "Format: CRN-YYYY-XXXX",
  auto: "Auto",
  contactPerson: "Contact Person",
  contactTitle: "Contact Title",
  selectTitle: "Select title...",
  contactPhone: "Contact Phone",
  contactEmail: "Contact Email",
  importLicenseNo: "Import License No",
  sectorType: "Sector Type",
  selectSector: "Select sector...",
  address: "Address",
  saving: "Saving...",
  saveImporter: "Save Importer",
  company: "Company",
  contact: "Contact",
  phone: "Phone",
  email: "Email",
  sector: "Sector",
  noRecords: "No records",
  companyRequired: "Company Name is required",
  tinInvalid: "TIN Number must be 7-15 digits",
  emailInvalid: "Contact Email is invalid",
  savedRedirecting: "Importer profile saved. Redirecting to Shipments...",
  alreadyRegisteredRedirecting: "Economic Operator already registered. Redirecting to Shipments...",
  alreadyRegisteredLocked: "Economic Operator already registered for your account.",
  importerDetails: "Importer Details",
};

const AM = {
  importers: "አስመጪዎች",
  registerImporter: "Register Importer",
  companyName: "የኩባንያ ስም",
  tinNumber: "TIN ቁጥር",
  customsRegNo: "የጉምሩክ ምዝገባ ቁጥር",
  crnFormatTitle: "ቅርጸት: CRN-YYYY-XXXX",
  auto: "አውቶ",
  contactPerson: "የግንኙነት ሰው",
  contactTitle: "የኃላፊነት ርዕስ",
  selectTitle: "ርዕስ ይምረጡ...",
  contactPhone: "የስልክ ቁጥር",
  contactEmail: "ኢሜይል",
  importLicenseNo: "የአስመጪ ፈቃድ ቁጥር",
  sectorType: "የዘርፍ አይነት",
  selectSector: "ዘርፍ ይምረጡ...",
  address: "አድራሻ",
  saving: "በማስቀመጥ ላይ...",
  saveImporter: "አስመጪ አስቀምጥ",
  company: "ኩባንያ",
  contact: "ግንኙነት",
  phone: "ስልክ",
  email: "ኢሜይል",
  sector: "ዘርፍ",
  noRecords: "መዝገብ የለም",
  companyRequired: "የኩባንያ ስም አስፈላጊ ነው",
  tinInvalid: "TIN ቁጥር 7-15 አሃዝ መሆን አለበት",
  emailInvalid: "ኢሜይል ልክ አይደለም",
  alreadyRegisteredLocked: "Economic Operator አስቀድሞ ተመዝግቧል።",
  importerDetails: "Importer Details",
};

