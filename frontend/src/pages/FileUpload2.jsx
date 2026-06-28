import React, { useEffect, useState } from "react";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { DocumentsAPI } from "../api/documentAPI.js";
import { SmartAPI } from "../api/smartAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { SkeletonText, SkeletonTable } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import JsonTree from "../components/JsonTree.jsx";
import DataTable from "../components/DataTable.jsx";
import SandboxPanel from "../components/SandboxPanel.jsx";

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
const MAX_FILES_PER_UPLOAD = 5;

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
  const [ocrMap, setOcrMap] = useState({});
  const [eligibleDeclarationIds, setEligibleDeclarationIds] = useState(new Set());
  const [docPreview, setDocPreview] = useState(null);
  const [docPreviewSize, setDocPreviewSize] = useState("mini");
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);

  const [loadingDecls, setLoadingDecls] = useState(true);
  useEffect(() => {
    (async () => {
      try { const decls = await DeclarationsAPI.list(); setDeclarations(Array.isArray(decls) ? decls : []); } catch {}
      finally { setLoadingDecls(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!Array.isArray(declarations) || declarations.length === 0) {
          setEligibleDeclarationIds(new Set());
          return;
        }
        const checks = await Promise.all(
          declarations.map(async (d) => {
            try {
              const v = await DocumentsAPI.verify(d.declaration_id);
              return { id: d.declaration_id, ok: !!v?.ok };
            } catch {
              return { id: d.declaration_id, ok: false };
            }
          })
        );
        const eligible = new Set(checks.filter((c) => !c.ok).map((c) => String(c.id)));
        setEligibleDeclarationIds(eligible);
        if (!declarationId) {
          const first = declarations.find((d) => eligible.has(String(d.declaration_id)));
          if (first) setDeclarationId(String(first.declaration_id));
        }
      } catch {}
    })();
  }, [declarations]);

  useEffect(() => {
    if (!declarationId) { setAttached([]); setVerif(null); return; }
    (async () => {
      try {
        const list = await DocumentsAPI.listByDeclaration(declarationId);
        setAttached(Array.isArray(list) ? list : []);
        const v = await DocumentsAPI.verify(declarationId);
        setVerif(v);
      } catch {}
    })();
  }, [declarationId]);

  useEffect(() => {
    setDocPreview((prev) => {
      if (prev?.url) {
        try { URL.revokeObjectURL(prev.url); } catch {}
      }
      return null;
    });
    setDocPreviewSize("mini");
  }, [declarationId]);

  useEffect(() => () => {
    if (docPreview?.url) {
      try { URL.revokeObjectURL(docPreview.url); } catch {}
    }
  }, [docPreview?.url]);

  function isFieldAlreadyUploaded(field) {
    const target = (field?.label || "").toLowerCase();
    return (attached || []).some((a) => String(a?.title || "").toLowerCase().includes(target));
  }

  const remainingFields = fields.filter((f) => !isFieldAlreadyUploaded(f));
  const hasNewFiles = fields.some((f) => !!files[f.name] && !isFieldAlreadyUploaded(f));
  const selectedNewFileCount = fields.filter((f) => !!files[f.name] && !isFieldAlreadyUploaded(f)).length;

  // Maintain object URLs for image previews and revoke old ones
  useEffect(() => {
    const next = {};
    try {
      Object.entries(files || {}).forEach(([key, f]) => {
        if (f && /^image\//i.test(f.type)) next[key] = URL.createObjectURL(f);
      });
      Object.entries(previews || {}).forEach(([key, url]) => {
        if (!next[key] || next[key] !== url) { try { URL.revokeObjectURL(url); } catch {} }
      });
      setPreviews(next);
    } catch {}
  }, [files]);

  const onFile = (name) => (e) => { setFiles({ ...files, [name]: e.target.files?.[0] || null }); };
  const clearFile = (name) => () => { const next = { ...files }; delete next[name]; setFiles(next); };

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
    e.preventDefault(); setDropHover(false); setErr(""); setOk("");
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length) return;
    const next = { ...files }; const dup = []; const overs = [];
    for (const f of dropped) {
      if (!/(pdf|png|jpe?g)$/i.test(f.name)) continue;
      if (f.size > 5 * 1024 * 1024) { overs.push(f.name); continue; }
      const guess = detectFieldByName(f.name);
      if (guess && !next[guess]) next[guess] = f; else { const empty = fields.find(x => !next[x.name]); if (empty) next[empty.name] = f; }
      try { const h = await sha256File(f); const match = (attached || []).find(a => (a.file_hash || '').toLowerCase() === h.toLowerCase()); if (match) dup.push(`${f.name} matches ${match.title}`); } catch {}
    }
    setFiles(next); setOversizeWarnings(overs); setDupWarnings(dup);
  }
  function onDragOver(e) { e.preventDefault(); setDropHover(true); }
  function onDragLeave(e) { e.preventDefault(); setDropHover(false); }

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk(""); setLoading(true);
    try {
      if (!declarationId) throw new Error(t.selectDeclarationErr);
      if (!hasNewFiles) throw new Error(t.noNewFilesToUpload || "No new files to upload for this declaration.");
      if (selectedNewFileCount > MAX_FILES_PER_UPLOAD) {
        throw new Error((t.maxFilesErr || "You can upload up to 5 files at a time.").replace("{max}", String(MAX_FILES_PER_UPLOAD)));
      }
      if (dupWarnings.length && !allowDuplicates) throw new Error(t.duplicateErr);
      const form = new FormData(); form.append("declaration_id", declarationId);
      fields.forEach(f => {
        if (isFieldAlreadyUploaded(f)) return;
        if (files[f.name]) form.append(f.name, files[f.name]);
      });
      const res = await DocumentsAPI.uploadBatch(form);
      const uploadedCount = Number(res?.count || 0);
      const skippedCount = Number(res?.skipped_count || 0);
      if (skippedCount > 0) {
        setOk(`${uploadedCount} document(s) uploaded, ${skippedCount} skipped (already uploaded).`);
      } else {
        setOk(`${uploadedCount} document(s) uploaded`);
      }
      const list = await DocumentsAPI.listByDeclaration(declarationId); setAttached(Array.isArray(list) ? list : []);
      const v = await DocumentsAPI.verify(declarationId); setVerif(v);
      setFiles({}); const formEl = document.getElementById('fileupload-form'); try { formEl?.reset?.(); } catch {}
    } catch (e2) { setErr(e2.message || t.uploadFailed); } finally { setLoading(false); }
  };

  async function anchorDoc(id) {
    try { setAnchoringId(id); await DocumentsAPI.anchor(id); const list = await DocumentsAPI.listByDeclaration(declarationId); setAttached(Array.isArray(list) ? list : []); }
    catch (e) { alert(e.message || t.anchorFailed); }
    finally { setAnchoringId(""); }
  }

  async function verifyHash(id) {
    try { setVerifyingId(id); const res = await DocumentsAPI.verifyHash(id); if (res?.ok) alert(t.verifiedAuthentic); else alert(t.tampered); }
    catch (e) { alert(e.message || t.verificationFailed); }
    finally { setVerifyingId(""); }
  }

  async function openDocument(a) {
    setDocPreviewLoading(true);
    try {
      const blob = await DocumentsAPI.downloadFile(a.document_id);
      const url = URL.createObjectURL(blob);
      setDocPreview((prev) => {
        if (prev?.url) {
          try { URL.revokeObjectURL(prev.url); } catch {}
        }
        return {
          url,
          name: a.file_name || a.title || "Document Preview",
          type: blob.type || a.file_type || "",
        };
      });
      setDocPreviewSize("mini");
    } catch (e) {
      alert(e.message || t.openFailed || "Failed to open document");
    } finally {
      setDocPreviewLoading(false);
    }
  }

  async function extractOcr(a) {
    try { const res = await SmartAPI.ocrExtract({ document_id: a.document_id, file_name: a.file_name }); setOcrMap((m) => ({ ...m, [a.document_id]: res })); alert(t.ocrCaptured); }
    catch (e) { alert(e.message || t.ocrFailed); }
  }

  const docColumns = [
    { key: "title", label: t.title },
    { key: "file_name", label: t.file, render: (a) => (<button type="button" onClick={() => openDocument(a)}>{a.file_name}</button>) },
    { key: "file_type", label: t.type },
    { key: "file_size", label: t.size },
    { key: "uploaded_at", label: t.uploaded },
    {
      key: "chain",
      label: t.chain,
      render: (a) => (
        <span>
          {a.blockchain_status || '-'}
          {a.blockchain_tx && (<span style={{ color: '#6b7280', marginLeft: 6 }}>({a.blockchain_network || 'stub'})</span>)}
        </span>
      )
    },
    {
      key: "actions",
      label: t.actions,
      render: (a) => (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" disabled={!!anchoringId} onClick={() => anchorDoc(a.document_id)}>
            {anchoringId === a.document_id ? t.anchoring : t.anchor}
          </button>
          <button type="button" disabled={!!verifyingId} onClick={() => verifyHash(a.document_id)}>
            {verifyingId === a.document_id ? t.verifying : t.verify}
          </button>
          <button type="button" onClick={() => extractOcr(a)}>{t.extract}</button>
        </span>
      )
    },
  ];

  return (
    <div className="fileupload-page">
      <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={handleDrop}
        style={{ margin: '8px 0 12px', padding: 16, border: `2px dashed ${dropHover ? '#2c65a5' : '#cbd5e1'}`, borderRadius: 8, background: dropHover ? '#eff6ff' : '#f8fafc', color: '#334155' }}>
        {t.dropHelp}
      </div>
      <div className="fileupload-sandbox">
        <SandboxPanel kicker="" title="File Upload" chips={[t.upload, t.attachedDocs, t.verification]}>
          <form id="fileupload-form" onSubmit={submit} className="fileupload-form">
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{t.declaration}</span>
              <select value={declarationId} onChange={(e)=> setDeclarationId(e.target.value)} style={{ padding: 10, border: '1px solid #ccc', borderRadius: 6, background: '#fff', color: '#000' }}>
                <option value="">{t.selectDeclaration}</option>
                {declarations
                  .filter((d) => eligibleDeclarationIds.size === 0 || eligibleDeclarationIds.has(String(d.declaration_id)))
                  .map(d => (<option key={d.declaration_id} value={d.declaration_id}>{d.declaration_no || d.declaration_id}</option>))}
              </select>
              {loadingDecls && (<div style={{ marginTop: 6 }}><SkeletonText lines={2} /></div>)}
              {!loadingDecls && declarations.length === 0 && (
                <div style={{ marginTop: 6 }}>
                  <EmptyState title={t.noDeclarations} description={t.noDeclarationsDesc} />
                </div>
              )}
            </label>
            {!!declarationId && remainingFields.map(f => {
              if (isFieldAlreadyUploaded(f)) return null;
              return (
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
                    <button type="button" onClick={clearFile(f.name)} style={{ border: '1px solid #ccc', background: '#fafafa', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>{t.remove}</button>
                  </div>
                )}
              </label>
            )})}
            {!!declarationId && remainingFields.length === 0 && (
              <div style={{ color: '#137333', background: '#ecfdf3', border: '1px solid #86efac', padding: 10, borderRadius: 6 }}>
                {t.allRequiredAlreadyUploaded || "All required document types are already uploaded for this declaration."}
              </div>
            )}
            {err && <div style={{ color: 'crimson' }}>{err}</div>}
            {(oversizeWarnings.length > 0) && (
              <div style={{ color: '#3f2a00', background: '#fef08a', border: '1px solid #facc15', padding: 8, borderRadius: 6 }}>
                {t.oversizeSkipped}: {oversizeWarnings.join(', ')} ({t.limit5mb})
              </div>
            )}
            {(dupWarnings.length > 0) && (
              <div style={{ color: '#3f2a00', background: '#fef08a', border: '1px solid #facc15', padding: 8, borderRadius: 6 }}>
                {t.duplicateDetected}
                <ul>{dupWarnings.map((d,i)=>(<li key={i}>{d}</li>))}</ul>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={allowDuplicates} onChange={(e)=> setAllowDuplicates(e.target.checked)} /> {t.allowDuplicates}
                </label>
              </div>
            )}
            {ok && <div style={{ color: 'green' }}>{ok}</div>}
            <button type="submit" disabled={loading || !hasNewFiles || selectedNewFileCount > MAX_FILES_PER_UPLOAD} style={{ width: 180 }}>
              {loading ? t.uploading : t.upload}
            </button>
          </form>
        </SandboxPanel>
      </div>

      <div className="fileupload-verification">
        <h3 className="fileupload-verification__title">{t.verification}</h3>
        {!declarationId && <div>{t.selectDeclarationToVerify}</div>}
        {declarationId && verif && (
          <div className="fileupload-verification__body">
            <div className="fileupload-verification__status">{t.attached}: {verif.attached} | {t.status}: {verif.ok ? t.complete : t.missing}</div>
            {!verif.ok && (
              <ul className="fileupload-verification__list">
                {verif.missing.map((m) => (<li key={m}>{m}</li>))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>{t.attachedDocs}</h3>
        {declarationId && loading && (
          <div style={{ paddingTop: 8 }}><SkeletonTable rows={3} cols={6} /></div>
        )}
        {attached.length === 0 && !loading && (
          <EmptyState title={t.noAttachments} description={t.noAttachmentsDesc} />
        )}
        {attached.length > 0 && (
          <div className="fileupload-documents-view">
            <DataTable columns={docColumns} rows={attached} dense emptyText={t.noAttachments} />
            <div className={`document-preview-box document-preview-box--${docPreviewSize}`}>
              <div className="document-preview-toolbar">
                <div>
                  <div className="document-preview-title">{docPreview?.name || t.documentPreview}</div>
                  <div className="document-preview-meta">{docPreview?.type || t.selectDocumentToPreview}</div>
                </div>
                <div className="document-preview-actions">
                  {docPreview?.url && (
                    <a href={docPreview.url} target="_blank" rel="noreferrer">{t.openNewTab}</a>
                  )}
                  <button type="button" onClick={() => setDocPreviewSize("mini")} disabled={docPreviewSize === "mini"}>{t.mini}</button>
                  <button type="button" onClick={() => setDocPreviewSize("max")} disabled={docPreviewSize === "max"}>{t.max}</button>
                </div>
              </div>
              <div className="document-preview-frame">
                {docPreviewLoading && <div className="document-preview-empty">{t.loadingDocument}</div>}
                {!docPreviewLoading && !docPreview && <div className="document-preview-empty">{t.selectDocumentToPreview}</div>}
                {!docPreviewLoading && docPreview && String(docPreview.type || "").toLowerCase().startsWith("image/") && (
                  <img src={docPreview.url} alt={docPreview.name} />
                )}
                {!docPreviewLoading && docPreview && !String(docPreview.type || "").toLowerCase().startsWith("image/") && (
                  <iframe title={docPreview.name} src={docPreview.url} />
                )}
              </div>
            </div>
          </div>
        )}
        {Object.keys(ocrMap).length > 0 && (
          <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.ocrExtracts}</div>
            {attached.filter(a => ocrMap[a.document_id]).map((a) => (
              <div key={a.document_id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{a.file_name}</div>
                <div style={{ background:'#f8f9fa', border:'1px solid #e5e7eb', borderRadius:6, padding:8 }}>
                  <JsonTree data={ocrMap[a.document_id] || {}} defaultOpenDepth={2} />
                </div>
              </div>
            ))}
          </div>
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
  ocrCaptured: "Extracted fields captured for review",
  ocrFailed: "OCR extract failed",
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
  extract: "Extract",
  dropHelp: "Drag & drop files here to auto-detect types (PDF/JPG/PNG, up to 5MB)",
  declaration: "Declaration",
  selectDeclaration: "Select declaration...",
  noDeclarations: "No declarations",
  noDeclarationsDesc: "Create a declaration first to attach documents.",
  allRequiredAlreadyUploaded: "All required document types are already uploaded for this declaration.",
  pdfSelected: "PDF selected",
  remove: "Remove",
  oversizeSkipped: "Oversize files skipped",
  limit5mb: "limit 5MB",
  duplicateDetected: "Possible duplicates detected:",
  allowDuplicates: "Allow duplicates anyway",
  maxFilesErr: "You can upload up to {max} files at a time.",
  uploading: "Uploading...",
  upload: "Upload",
  verification: "Verification",
  selectDeclarationToVerify: "Select a declaration to verify required documents.",
  attached: "Attached",
  status: "Status",
  complete: "Complete",
  missing: "Missing",
  attachedDocs: "Attached Documents",
  documentPreview: "Document Preview",
  selectDocumentToPreview: "Select a document to preview.",
  loadingDocument: "Loading document...",
  openNewTab: "Open new tab",
  mini: "Mini",
  max: "Max",
  noAttachments: "No attachments",
  noAttachmentsDesc: "Drop files above or use the fields to add documents.",
  ocrExtracts: "OCR Extracts (latest)",
};

const AM = {
  selectDeclarationErr: "እባክዎ መግለጫ ይምረጡ",
  duplicateErr: "ተመሳሳይ ሰነዶች ተገኝተዋል። ያጥፉ ወይም ይፍቀዱ።",
  uploadFailed: "መጫን አልተሳካም",
  anchorFailed: "Anchor ማድረግ አልተሳካም",
  verifiedAuthentic: "ተረጋግጧል: እውነተኛ ነው",
  tampered: "ተቀይሯል ወይም አይዛመድም",
  verificationFailed: "ማረጋገጥ አልተሳካም",
  ocrCaptured: "የOCR ውጤቶች ለግምገማ ተያዙ",
  ocrFailed: "OCR ማውጣት አልተሳካም",
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
  extract: "አውጣ",
  dropHelp: "ፋይሎችን ወደዚህ ጎትተው ይጣሉ አይነት በራስ-ሰር እንዲለይ (PDF/JPG/PNG, እስከ 5MB)",
  declaration: "መግለጫ",
  selectDeclaration: "መግለጫ ይምረጡ...",
  noDeclarations: "መግለጫ የለም",
  noDeclarationsDesc: "ሰነዶች ለማያያዝ መጀመሪያ መግለጫ ይፍጠሩ።",
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
  documentPreview: "Document Preview",
  selectDocumentToPreview: "Select a document to preview.",
  loadingDocument: "Loading document...",
  openNewTab: "Open new tab",
  mini: "Mini",
  max: "Max",
  noAttachments: "አባሪ የለም",
  noAttachmentsDesc: "ፋይሎችን ከላይ ይጣሉ ወይም መስኮችን ይጠቀሙ።",
  ocrExtracts: "የOCR ውጤቶች (የቅርብ ጊዜ)",
};



