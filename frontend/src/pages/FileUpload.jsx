import React, { useEffect, useMemo, useState } from "react";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { DocumentsAPI } from "../api/documentAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const fields = [
  { name: "commercial_invoice", label: "Commercial Invoice" },
  { name: "packing_list", label: "Packing List" },
  { name: "bill_of_lading", label: "Bill of Lading" },
  { name: "airway_bill", label: "Airway Bill" },
  { name: "certificate_of_origin", label: "Certificate of Origin" },
  { name: "import_permit", label: "Import Permit" },
  { name: "letter_of_credit", label: "Letter of Credit" },
  { name: "insurance_certificate", label: "Insurance Certificate" },
];

export default function FileUpload() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const { role } = useAuth();
  const [declarations, setDeclarations] = useState([]);
  const [declarationId, setDeclarationId] = useState("");
  const [files, setFiles] = useState({});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [verif, setVerif] = useState(null);
  const [attached, setAttached] = useState([]);
  const [verifyingId, setVerifyingId] = useState("");
  const [anchoringId, setAnchoringId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [dupWarnings, setDupWarnings] = useState([]);
  const [oversizeWarnings, setOversizeWarnings] = useState([]);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const decls = await DeclarationsAPI.list();
        setDeclarations(Array.isArray(decls) ? decls : []);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (!declarationId) { setAttached([]); setVerif(null); return; }
    (async () => {
      try {
        const list = await DocumentsAPI.listByDeclaration(declarationId);
        setAttached(Array.isArray(list) ? list : []);
        const v = await DocumentsAPI.verify(declarationId);
        setVerif(v);
      } catch (e) { /* ignore */ }
    })();
  }, [declarationId]);

  // Maintain object URLs for image previews and revoke old ones
  useEffect(() => {
    const next = {};
    try {
      Object.entries(files || {}).forEach(([key, f]) => {
        if (f && /^image\//i.test(f.type)) {
          next[key] = URL.createObjectURL(f);
        }
      });
      Object.entries(previews || {}).forEach(([key, url]) => {
        if (!next[key] || next[key] !== url) {
          try { URL.revokeObjectURL(url); } catch {}
        }
      });
      setPreviews(next);
    } catch {}
  }, [files]);  const onFile = (name) => (e) => {
    setFiles({ ...files, [name]: e.target.files?.[0] || null });
  };

  const clearFile = (name) => () => {
    const next = { ...files };
    delete next[name];
    setFiles(next);
  };


  function detectFieldByName(fileName = "") {
    const n = (fileName || "").toLowerCase();
    if (/invoice|commercial/.test(n)) return "commercial_invoice";
    if (/packing/.test(n)) return "packing_list";
    if (/bill[_-]?of[_-]?lading|bol|lading/.test(n)) return "bill_of_lading";
    if (/airway|awb/.test(n)) return "airway_bill";
    if (/certificate[_-]?of[_-]?origin|coo/.test(n)) return "certificate_of_origin";
    if (/import[_-]?permit|permit/.test(n)) return "import_permit";
    if (/letter[_-]?of[_-]?credit|lc/.test(n)) return "letter_of_credit";
    if (/insurance/.test(n)) return "insurance_certificate";
    return null;
  }

  async function sha256File(file) {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const bytes = new Uint8Array(hashBuf);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDropHover(false);
    setErr(""); setOk("");
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length) return;
    const next = { ...files };
    const dup = [];
    const overs = [];
    for (const f of dropped) {
      if (!/(pdf|png|jpe?g)$/i.test(f.name)) continue;
      if (f.size > 5 * 1024 * 1024) { overs.push(f.name); continue; }
      const guess = detectFieldByName(f.name);
      if (guess && !next[guess]) next[guess] = f;
      else {
        // put into first empty slot
        const empty = fields.find(x => !next[x.name]);
        if (empty) next[empty.name] = f;
      }
      try {
        const h = await sha256File(f);
        const match = (attached || []).find(a => (a.file_hash || '').toLowerCase() === h.toLowerCase());
        if (match) dup.push(`${f.name} matches ${match.title}`);
      } catch {}
    }
    setFiles(next);
    setOversizeWarnings(overs);
    setDupWarnings(dup);
  }

  function onDragOver(e) { e.preventDefault(); setDropHover(true); }
  function onDragLeave(e) { e.preventDefault(); setDropHover(false); }

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOk(""); setLoading(true);
    try {
      if (!declarationId) throw new Error(t.selectDeclarationErr);
      if (dupWarnings.length && !allowDuplicates) throw new Error(t.duplicateErr);
      const form = new FormData();
      form.append("declaration_id", declarationId);
      fields.forEach(f => { if (files[f.name]) form.append(f.name, files[f.name]); });
      const res = await DocumentsAPI.uploadBatch(form);
      setOk(`${res.count || 0} document(s) uploaded`);
      // refresh
      const list = await DocumentsAPI.listByDeclaration(declarationId);
      setAttached(Array.isArray(list) ? list : []);
      const v = await DocumentsAPI.verify(declarationId);
      setVerif(v);
      setFiles({});
      (document.getElementById('fileupload-form')?.reset?.());
    } catch (e2) {
      setErr(e2.message || t.uploadFailed);
    } finally { setLoading(false); }
  };

  async function anchorDoc(id) {
    try {
      setAnchoringId(id);
      await DocumentsAPI.anchor(id);
      const list = await DocumentsAPI.listByDeclaration(declarationId);
      setAttached(Array.isArray(list) ? list : []);
    } catch (e) {
      alert(e.message || t.anchorFailed);
    } finally {
      setAnchoringId("");
    }
  }

  async function verifyHash(id) {
    try {
      setVerifyingId(id);
      const res = await DocumentsAPI.verifyHash(id);
      if (res?.ok) alert(t.verifiedAuthentic);
      else alert(t.tampered);
    } catch (e) {
      alert(e.message || t.verificationFailed);
    } finally {
      setVerifyingId("");
    }
  }

  async function openDocument(a) {
    try {
      const blob = await DocumentsAPI.downloadFile(a.document_id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e.message || "Failed to open document");
    }
  }

  return (
    <div>
      <h2>{t.uploadSupportingDocs}</h2>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        style={{
          margin: '8px 0 12px',
          padding: 16,
          border: `2px dashed ${dropHover ? '#0d6efd' : '#cbd5e1'}`,
          borderRadius: 8,
          background: dropHover ? '#eff6ff' : '#f8fafc',
          color: '#334155',
        }}
      >
        {t.dropHelp}
      </div>
      <form id="fileupload-form" onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{t.declaration}</span>
          <select value={declarationId} onChange={(e)=> setDeclarationId(e.target.value)} style={{ padding: 10, border: '1px solid #ccc', borderRadius: 6 }}>
            <option value="">{t.selectDeclaration}</option>
            {declarations.map(d => (
              <option key={d.declaration_id} value={d.declaration_id}>{d.declaration_no || d.declaration_id}</option>
            ))}
          </select>
        </label>
        {fields.map(f => (
          <label key={f.name} style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{f.label}</span>
            <input type="file" onChange={onFile(f.name)} accept="application/pdf,image/jpeg,image/png" />
            {files[f.name] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid #e5e7eb', padding: 8, borderRadius: 6 }}>
                {(/^image\//i.test(files[f.name].type)) ? (
                  <img src={previews[f.name]} alt="preview" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{t.pdfSelected}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{files[f.name].name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{Math.round(files[f.name].size / 1024)} KB</div>
                </div>
                <button type="button" onClick={clearFile(f.name)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>{t.remove}</button>
              </div>
            )}
          </label>
        ))}
        {err && <div style={{ color: 'crimson' }}>{err}</div>}
        {(oversizeWarnings.length > 0) && (
          <div style={{ color: '#3f2a00', background: '#fef08a', border: '1px solid #facc15', padding: 8, borderRadius: 6 }}>
            {t.oversizeSkipped}: {oversizeWarnings.join(', ')} ({t.limit5mb})
          </div>
        )}
        {(dupWarnings.length > 0) && (
          <div style={{ color: '#3f2a00', background: '#fef08a', border: '1px solid #facc15', padding: 8, borderRadius: 6 }}>
            {t.duplicateDetected}
            <ul>
              {dupWarnings.map((d,i)=>(<li key={i}>{d}</li>))}
            </ul>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={allowDuplicates} onChange={(e)=> setAllowDuplicates(e.target.checked)} />
              {t.allowDuplicates}
            </label>
          </div>
        )}
        {ok && <div style={{ color: 'green' }}>{ok}</div>}
        <button type="submit" disabled={loading} style={{ width: 180 }}>{loading ? t.uploading : t.upload}</button>
      </form>

      <div style={{ marginTop: 20 }}>
        <h3>{t.verification}</h3>
        {!declarationId && <div>{t.selectDeclarationToVerify}</div>}
        {declarationId && verif && (
          <div>
            <div>{t.attached}: {verif.attached} | {t.status}: {verif.ok ? t.complete : t.missing}</div>
            {!verif.ok && (
              <ul>
                {verif.missing.map(m => (<li key={m}>{m}</li>))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>{t.attachedDocs}</h3>
        {attached.length === 0 && <div>{t.noDocumentsFound}</div>}
        {attached.length > 0 && (
          <table className="smart-table" style={{ width: '100%' , borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">{t.title}</th>
                <th align="left">{t.file}</th>
                <th align="left">{t.type}</th>
                <th align="left">{t.size}</th>
                <th align="left">{t.uploaded}</th>
                <th align="left">{t.chain}</th>
                <th align="left">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {attached.map(a => (
                <tr key={a.document_id}>
                  <td>{a.title}</td>
                  <td><button type="button" onClick={() => openDocument(a)}>{a.file_name}</button></td>
                  <td>{a.file_type}</td>
                  <td>{a.file_size}</td>
                  <td>{a.uploaded_at}</td>
                  <td>
                    {a.blockchain_status || 'ï¿½'}
                    {a.blockchain_tx && (
                      <span style={{ color: '#6b7280', marginLeft: 6 }}>({a.blockchain_network || 'stub'})</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={!!anchoringId} onClick={() => anchorDoc(a.document_id)}>
                      {anchoringId === a.document_id ? t.anchoring : t.anchor}
                    </button>
                    <button type="button" disabled={!!verifyingId} onClick={() => verifyHash(a.document_id)}>
                      {verifyingId === a.document_id ? t.verifying : t.verify}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const EN = {
  selectDeclarationErr: "Please select a declaration",
  duplicateErr: "Duplicate documents detected. Uncheck or allow duplicates.",
  uploadFailed: "Upload failed",
  anchorFailed: "Failed to anchor",
  verifiedAuthentic: "Verified: authentic",
  tampered: "Tampered or mismatch",
  verificationFailed: "Verification failed",
  uploadSupportingDocs: "Upload Supporting Documents",
  dropHelp: "Drag & drop files here to auto-detect types (PDF/JPG/PNG, up to 5MB)",
  declaration: "Declaration",
  selectDeclaration: "Select declaration...",
  pdfSelected: "PDF selected",
  remove: "Remove",
  oversizeSkipped: "Oversize files skipped",
  limit5mb: "limit 5MB",
  duplicateDetected: "Possible duplicates detected:",
  allowDuplicates: "Allow duplicates anyway",
  uploading: "Uploading...",
  upload: "Upload",
  verification: "Verification",
  selectDeclarationToVerify: "Select a declaration to verify required documents.",
  attached: "Attached",
  status: "Status",
  complete: "Complete",
  missing: "Missing",
  attachedDocs: "Attached Documents",
  noDocumentsFound: "No documents found.",
  title: "Title",
  file: "File",
  type: "Type",
  size: "Size",
  uploaded: "Uploaded",
  chain: "Chain",
  actions: "Actions",
  anchoring: "Anchoring...",
  anchor: "Anchor",
  verifying: "Verifying...",
  verify: "Verify",
};

const AM = {
  selectDeclarationErr: "እባክዎ መግለጫ ይምረጡ",
  duplicateErr: "ተመሳሳይ ሰነዶች ተገኝተዋል። ያጥፉ ወይም ይፍቀዱ።",
  uploadFailed: "መጫን አልተሳካም",
  anchorFailed: "Anchor ማድረግ አልተሳካም",
  verifiedAuthentic: "ተረጋግጧል: እውነተኛ ነው",
  tampered: "ተቀይሯል ወይም አይዛመድም",
  verificationFailed: "ማረጋገጥ አልተሳካም",
  uploadSupportingDocs: "የሚደግፉ ሰነዶችን ጫን",
  dropHelp: "ፋይሎችን ወደዚህ ጎትተው ይጣሉ አይነት በራስ-ሰር እንዲለይ (PDF/JPG/PNG, እስከ 5MB)",
  declaration: "መግለጫ",
  selectDeclaration: "መግለጫ ይምረጡ...",
  pdfSelected: "PDF ተመርጧል",
  remove: "አስወግድ",
  oversizeSkipped: "ከመጠን በላይ ፋይሎች ተዘለሉ",
  limit5mb: "ገደብ 5MB",
  duplicateDetected: "ተመሳሳይ ፋይሎች ሊኖሩ ይችላሉ:",
  allowDuplicates: "ቢሆንም ተመሳሳይ ይፍቀዱ",
  uploading: "በመጫን ላይ...",
  upload: "ጫን",
  verification: "ማረጋገጫ",
  selectDeclarationToVerify: "አስፈላጊ ሰነዶችን ለማረጋገጥ መግለጫ ይምረጡ።",
  attached: "የተያያዙ",
  status: "ሁኔታ",
  complete: "ተሟልቷል",
  missing: "የጎደለ",
  attachedDocs: "የተያያዙ ሰነዶች",
  noDocumentsFound: "ሰነዶች አልተገኙም።",
  title: "ርዕስ",
  file: "ፋይል",
  type: "አይነት",
  size: "መጠን",
  uploaded: "የተጫነበት",
  chain: "Chain",
  actions: "እርምጃዎች",
  anchoring: "Anchor በማድረግ ላይ...",
  anchor: "Anchor",
  verifying: "በማረጋገጥ ላይ...",
  verify: "አረጋግጥ",
};










