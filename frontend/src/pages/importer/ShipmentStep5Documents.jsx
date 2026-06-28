import React, { useEffect, useRef, useState } from "react";
import { DocumentsAPI } from "../../api/documentAPI.js";
import { useLanguage } from "../../context/LanguageContext.jsx";

const REQUIRED = [
  "Commercial Invoice",
  "Packing List",
  "Certificate of Origin",
  "Bill of Lading",
];

export default function ShipmentStep5Documents({ data, onChange, next, prev }) {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const inputRef = useRef(null);
  const local = data || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [docType, setDocType] = useState(REQUIRED[0]);
  const [customTitle, setCustomTitle] = useState("");

  const files = Array.isArray(local.files) ? local.files : [];
  const titles = files.map((f) => String(f.title || "").toLowerCase());
  const completedRequired = REQUIRED.filter((r) => titles.some((t) => t.includes(r.toLowerCase())));
  const allRequiredUploaded = completedRequired.length === REQUIRED.length;
  const availableRequired = REQUIRED.filter((r) => !titles.some((t) => t.includes(r.toLowerCase())));

  useEffect(() => {
    if (docType !== "Other" && !availableRequired.includes(docType)) {
      setDocType(availableRequired[0] || "Other");
    }
  }, [docType, availableRequired]);

  const onPick = async (fileList) => {
    setErr("");
    const file = fileList?.[0];
    if (!file) return;
    const chosenTitle = docType === "Other"
      ? String(customTitle || "").trim()
      : docType;
    if (!chosenTitle) {
      setErr(t.errSelectDocType);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", chosenTitle);
    setBusy(true);
    try {
      const uploaded = await DocumentsAPI.upload(form);
      const nextFiles = [...files, uploaded];
      onChange({ files: nextFiles });
    } catch (e) {
      setErr(e.message || t.errUpload);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    onPick(e.dataTransfer.files);
  };

  return (
    <div className="eu-card">
      <h3>{t.stepTitle}</h3>
      <p className="eu-help">{t.stepHelp}</p>

      <div className="eu-doc-grid">
        <div className="eu-doc-required">
          <h4>{t.requiredDocs}</h4>
          {REQUIRED.map((r) => {
            const ok = titles.some((t) => t.includes(r.toLowerCase()));
            return (
              <div key={r} className={`eu-doc-row ${ok ? "ok" : ""}`}>
                <span>{r}</span>
                <span>{ok ? t.uploaded : t.pending}</span>
              </div>
            );
          })}
        </div>

        {!allRequiredUploaded && (
          <div
            className="eu-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div style={{ width: "100%", display: "grid", gap: 6, marginBottom: 8 }}>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {availableRequired.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="Other">{t.other}</option>
              </select>
              {docType === "Other" && (
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={t.docTitle}
                />
              )}
            </div>
            <div>{t.dragDrop}</div>
            <div className="eu-help">{t.or}</div>
            <button className="eu-btn" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? t.uploading : t.chooseFile}
            </button>
            <input
              ref={inputRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => onPick(e.target.files)}
            />
            {err && <div className="err">{err}</div>}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="eu-upload-list">
          {files.map((f) => (
            <div key={f.document_id || f.file_name} className="eu-upload-item">
              <span>{f.title || f.file_name}</span>
              <span>{f.file_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="eu-nav">
        <button className="eu-btn" onClick={prev}>{t.back}</button>
        <button className="eu-btn primary" onClick={next} disabled={!allRequiredUploaded}>
          {t.next}
        </button>
      </div>
      {!allRequiredUploaded && (
        <div className="err">{t.uploadAllRequired}</div>
      )}
    </div>
  );
}

const EN = {
  stepTitle: "Step 5: Supporting Documents",
  stepHelp: "Attach mandatory shipment evidence before customs submission.",
  requiredDocs: "Required Documents",
  uploaded: "Uploaded",
  pending: "Pending",
  other: "Other",
  docTitle: "Document title",
  dragDrop: "Drag & Drop document here",
  or: "or",
  uploading: "Uploading...",
  chooseFile: "Choose File",
  back: "Back",
  next: "Next",
  uploadAllRequired: "Upload all required documents to continue.",
  errSelectDocType: "Please select a document type or provide a title.",
  errUpload: "Failed to upload document",
};

const AM = {
  stepTitle: "ደረጃ 5: የሚደግፉ ሰነዶች",
  stepHelp: "ወደ ጉምሩክ ከማቅረብዎ በፊት አስፈላጊ የጭነት ማስረጃዎችን ያያይዙ።",
  requiredDocs: "አስፈላጊ ሰነዶች",
  uploaded: "ተጭኗል",
  pending: "በመጠባበቅ ላይ",
  other: "ሌላ",
  docTitle: "የሰነድ ርዕስ",
  dragDrop: "ሰነዱን ወደዚህ ጎትተው ይጣሉ",
  or: "ወይም",
  uploading: "በመጫን ላይ...",
  chooseFile: "ፋይል ይምረጡ",
  back: "ተመለስ",
  next: "ቀጣይ",
  uploadAllRequired: "ለመቀጠል ሁሉንም አስፈላጊ ሰነዶች ይጫኑ።",
  errSelectDocType: "እባክዎ የሰነድ አይነት ይምረጡ ወይም ርዕስ ያስገቡ።",
  errUpload: "ሰነዱን መጫን አልተሳካም",
};
