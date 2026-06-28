import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { DocumentsAPI } from "../api/documentAPI.js";
import { SingleWindowAPI } from "../api/singleWindowAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonTable } from "../components/Skeleton.jsx";
import DataTable from "../components/DataTable.jsx";
import ExportActions from "../components/ExportActions.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function DeclarationsAdmin() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();
  const [swEnabled, setSwEnabled] = useState(() => {
    try { const v = localStorage.getItem('features.declarations.sw'); if (v != null) return v === 'true'; } catch {}
    try { return import.meta.env?.VITE_DECL_SW_ENABLED === 'true'; } catch {}
    // Enable SW column by default; users can toggle off
    return true;
  });
  useEffect(() => { try { localStorage.setItem('features.declarations.sw', String(swEnabled)); } catch {} }, [swEnabled]);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // all | invalid | duplicate
  const [docsOpen, setDocsOpen] = useState(false);
  const [docItems, setDocItems] = useState([]);
  const [docsErr, setDocsErr] = useState("");
  const [docsLoading, setDocsLoading] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const [docPreviewSize, setDocPreviewSize] = useState("mini");
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [swPoll, setSwPoll] = useState(null);
  const [swAuto, setSwAuto] = useState(() => { try { return (localStorage.getItem('decl.swstatus.auto') || 'false') === 'true'; } catch { return false; } });
  const [swSec, setSwSec] = useState(() => { try { return Number(localStorage.getItem('decl.swstatus.sec') || 60); } catch { return 60; } });
  const [swCountdown, setSwCountdown] = useState(0);
  useEffect(() => { try { localStorage.setItem('decl.swstatus.auto', String(swAuto)); } catch {} }, [swAuto]);
  useEffect(() => { try { localStorage.setItem('decl.swstatus.sec', String(swSec)); } catch {} }, [swSec]);
  useEffect(() => {
    if (!swAuto || !Number.isFinite(swSec) || swSec <= 0) { setSwCountdown(0); return; }
    setSwCountdown(Math.max(10, swSec));
    const t = setInterval(() => {
      setSwCountdown((c) => {
        const next = (c || 0) - 1;
        if (next <= 0) {
          (async () => { try { const s = await SingleWindowAPI.status(); setSwPoll(s); } catch {} })();
          return Math.max(10, swSec);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [swAuto, swSec]);
  // Single Window UI removed here to keep this screen stable; use Single Window page instead

  const load = async () => {
    setErr("");
    try {
      const list = await DeclarationsAPI.list();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || t.failedLoadDeclarations);
    }
  };

  useEffect(() => { load(); }, []);


  const clearDocPreview = () => {
    setDocPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setDocPreviewLoading(false);
    setDocPreviewSize("mini");
  };

  useEffect(() => () => {
    if (docPreview?.url) URL.revokeObjectURL(docPreview.url);
  }, [docPreview?.url]);

  const closeDocs = () => {
    clearDocPreview();
    setDocsOpen(false);
  };

  const openDocs = async (declaration_id) => {
    setDocsErr("");
    clearDocPreview();
    setDocsOpen(true);
    setDocsLoading(true);
    try {
      const items = await DocumentsAPI.listByDeclaration(declaration_id);
      setDocItems(Array.isArray(items) ? items : []);
    } catch (e) {
      setDocsErr(e.message || t.failedLoadDocuments);
    } finally {
      setDocsLoading(false);
    }
  };

  const openDocument = async (doc) => {
    setDocsErr("");
    setDocPreviewLoading(true);
    try {
      const blob = await DocumentsAPI.downloadFile(doc.document_id);
      const url = URL.createObjectURL(blob);
      setDocPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          name: doc.file_name || doc.title || t.documentPreview,
          type: blob.type || doc.file_type || "",
        };
      });
      setDocPreviewSize("mini");
    } catch (e) {
      setDocsErr(e.message || t.openFailed || "Failed to open document");
      toast?.error?.(e.message || t.openFailed || "Failed to open document");
    } finally {
      setDocPreviewLoading(false);
    }
  };

  const approve = async (id) => {
    setLoading(true); setErr("");
    try { await DeclarationsAPI.approve(id); await load(); }
    catch (e) { setErr(e.message || t.approveFailed); }
    finally { setLoading(false); }
  };

  const reject = async (id) => {
    const reason = window.prompt(t.rejectionReasonPrompt) || '';
    setLoading(true); setErr("");
    try { await DeclarationsAPI.reject(id, reason); await load(); }
    catch (e) { setErr(e.message || t.rejectFailed); }
    finally { setLoading(false); }
  };

  const regenerate = async (id) => {
    if (!window.confirm(t.regenerateConfirm)) return;
    setLoading(true); setErr("");
    try { await DeclarationsAPI.regenerateNumber(id); await load(); }
    catch (e) { setErr(e.message || t.regenerateFailed); }
    finally { setLoading(false); }
  };

  const isValidDecNo = (v) => /^DEC-(ET-)?\d{4}-\d{4,6}$/.test(String(v || ''));
  const counts = items.reduce((acc, d) => {
    const no = d.declaration_no || '';
    if (!no) return acc;
    acc[no] = (acc[no] || 0) + 1;
    return acc;
  }, {});

  const approveGuarded = async (d) => {
    const no = d.declaration_no || '';
    const invalid = !no || !isValidDecNo(no);
    const duplicate = no && counts[no] > 1;
    if (invalid || duplicate) {
      const proceed = window.confirm(`${t.declarationNoIs} ${invalid ? t.invalid : ''}${invalid && duplicate ? ` ${t.and} ` : ''}${duplicate ? t.duplicate : ''}. ${t.approveAnyway}`);
      if (!proceed) return;
    }
    await approve(d.declaration_id);
  };

  const filtered = items.filter((d) => {
    if (filterMode === 'all') return true;
    const no = d.declaration_no || '';
    const invalid = !no || !isValidDecNo(no);
    const duplicate = no && counts[no] > 1;
    if (filterMode === 'invalid') return invalid;
    if (filterMode === 'duplicate') return !invalid && duplicate;
    return true;
  });

  // SW logic moved to Single Window page; no SW preload here

  const [findNo, setFindNo] = useState("");
  const findNow = async () => {
    setErr("");
    try {
      if (!findNo) { await load(); return; }
      const row = await DeclarationsAPI.find(findNo);
      if (!row) { setItems([]); return; }
      setItems([row]);
      setFilterMode("all");
    } catch (e) {
      setErr(e.message || t.notFound);
    }
  };

  const declColumns = useMemo(() => {
    const cols = [
      {
        key: "declaration_no",
        label: t.declarationNo,
        render: (d) => {
          const no = d.declaration_no || "-";
          const invalid = !no || !isValidDecNo(no);
          const duplicate = no && counts[no] > 1;
          return (
            <span>
              {no}
              {invalid && <span style={{ marginLeft: 8, background: '#fdecea', color: '#b00020', padding: '2px 6px', borderRadius: 4 }}>{t.invalid}</span>}
              {!invalid && duplicate && <span style={{ marginLeft: 8, background: '#fef08a', color: '#3f2a00', padding: '2px 6px', borderRadius: 4 }}>{t.duplicate}</span>}
            </span>
          );
        }
      },
      { key: "declaration_date", label: t.date },
      { key: "shipment_reference", label: t.shipment },
      { key: "risk", label: t.risk, render: (d) => <RiskBadge channel={d.risk_channel || "Green"} score={Number(d.risk_score || 0)} /> },
      {
        key: "status",
        label: t.status,
        render: (d) => {
          return <StatusBadge status={d.status || "Pending"} />;
        }
      },
    ];
    if (swEnabled) {
      cols.push({
        key: "sw",
        label: "SW",
        render: (d) => (
          <a href={`/single-window?q=${encodeURIComponent(d.declaration_no || '')}`}>Open SW</a>
        ),
      });
    }
    cols.push({
      key: "actions",
        label: t.actions,
      render: (d) => (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {(() => {
            const status = String(d.status || "Pending");
            const isAccepted = status === "Accepted";
            const isRejected = status === "Rejected";
            const canApprove = !isAccepted;
            const canReject = !isRejected;
            return (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); openDocs(d.declaration_id); }} style={{ marginRight: 0 }}>{t.documents}</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); regenerate(d.declaration_id); }} disabled={loading} style={{ marginRight: 0 }}>{t.regenerateNo}</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); approveGuarded(d); }} disabled={loading || !canApprove} style={{ marginRight: 0 }}>{isAccepted ? t.approved : t.approve}</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); reject(d.declaration_id); }} disabled={loading || !canReject}>{isRejected ? t.rejected : t.reject}</button>
              </>
            );
          })()}
        </span>
      ),
    });
    return cols;
  }, [swEnabled, counts, loading]);

  const docsColumns = useMemo(() => ([
    { key: "title", label: t.title, render: (d) => d.title || "-" },
    { key: "file_name", label: t.file },
    { key: "file_type", label: t.type, render: (d) => d.file_type || "-" },
    { key: "file_size", label: t.size, render: (d) => d.file_size || "-" },
    { key: "uploaded_at", label: t.uploaded },
    { key: "open", label: t.open, render: (d) => d.document_id ? (<button type="button" onClick={() => openDocument(d)} title={t.openDocument}>{t.open}</button>) : '-' },
  ]), [t.title, t.file, t.type, t.size, t.uploaded, t.open, t.openDocument]);

  const downloadCsv = async (filename, path) => {
    try {
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(path, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast?.success(`${t.exportReady}: ${filename}`);
    } catch (e) {
      toast?.error?.(e.message || t.exportFailed);
    }
  };

  return (
    <div className="declarations-page-shell">
      <div className="declarations-page-panel">
        <div className="declarations-page-section declarations-page-section--head">
          <div className="declarations-page-section-head">
            <div>
              <div className="declarations-page-kicker">{t.declarationsAdmin}</div>
              <h2 className="declarations-page-title">{t.declarationsAdmin}</h2>
            </div>
          </div>
        </div>

        {err && <div className="declarations-page-error">{err}</div>}

        <section className="declarations-page-section declarations-page-records-panel" aria-label={t.declarationsAdmin}>
          <div className="declarations-admin-table-wrap">
            <DataTable
              columns={declColumns}
              rows={filtered}
              emptyText={t.noDeclarationsFound}
              onRowClick={(d) => {
                if (!d.declaration_id) return;
                navigate({ pathname: '/declarations', search: d.declaration_id ? ('?declaration_id='+encodeURIComponent(d.declaration_id)) : '' });
              }}
            />
            {filtered.length === 0 && (
              <div className="declarations-page-empty">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.noDeclarationsFound}</div>
                <div style={{ color: '#6b7280', marginBottom: 10 }}>{t.createNewDecl}</div>
                <button onClick={() => navigate('/declarations')} style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 0, borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                  {t.createDeclaration}
                </button>
              </div>
            )}
          </div>
        </section>

        <Modal open={docsOpen} title={t.declarationDocuments} onClose={closeDocs} variant="document">
        {docsErr && <div style={{ color: '#b00020', marginBottom: 8 }}>{docsErr}</div>}
        {docsLoading && (
          <div style={{ padding: 8 }}>
            <SkeletonTable rows={4} cols={6} />
          </div>
        )}
        {!docsLoading && docItems.length === 0 && (
          <EmptyState title={t.noDocuments} description={t.noFilesUploaded} />
        )}
        {!docsLoading && docItems.length > 0 && (
          <div className="declaration-documents-view">
            <DataTable columns={docsColumns} rows={docItems} dense />
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
        </Modal>

        <Modal open={importOpen} title={t.importDeclarationNumbers} onClose={()=> setImportOpen(false)}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{t.pasteCsv}: declaration_id,declaration_no</div>
          <textarea rows={8} value={importText} onChange={(e)=> setImportText(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
          <div>
            <button type="button" onClick={async ()=>{
              try {
                setLoading(true); setErr(""); setImportResult(null);
                const res = await fetch('/api/declarations/maintenance/import-numbers', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: importText })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || t.importFailed);
                setImportResult(data);
                await load();
              } catch (e) { setErr(e.message || t.importFailed); }
              finally { setLoading(false); }
            }}>{t.upload}</button>
          </div>
          {importResult && (
            <div style={{ fontSize: 13 }}>
              <div>{t.summary}: {Object.entries(importResult.summary || {}).map(([k,v])=> `${k}:${v}`).join('  ')}</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, border: '1px solid #e5e7eb', padding: 6 }}>
                {(importResult.results || []).slice(0,200).map((r, i) => (
                  <div key={i}>
                    {r.id} - {r.no} - {r.status}{r.reason ? ` (${r.reason})` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </Modal>
      </div>
    </div>
  );
}

const EN = {
  failedLoadDeclarations: "Failed to load declarations",
  failedLoadDocuments: "Failed to load documents",
  approveFailed: "Approve failed",
  rejectionReasonPrompt: "Rejection reason (optional)",
  rejectFailed: "Reject failed",
  regenerateConfirm: "Regenerate Declaration No for this record?",
  regenerateFailed: "Regenerate failed",
  declarationNoIs: "Declaration No is",
  invalid: "Invalid",
  duplicate: "Duplicate",
  and: "and",
  approveAnyway: "Approve anyway?",
  notFound: "Not found",
  declarationNo: "Declaration No",
  date: "Date",
  shipment: "Shipment",
  risk: "Risk",
  status: "Status",
  actions: "Actions",
  documents: "Documents",
  regenerateNo: "Regenerate No",
  approved: "Approved",
  approve: "Approve",
  rejected: "Rejected",
  reject: "Reject",
  title: "Title",
  file: "File",
  type: "Type",
  size: "Size",
  uploaded: "Uploaded",
  open: "Open",
  openDocument: "Open document",
  documentPreview: "Document Preview",
  selectDocumentToPreview: "Select a document to preview.",
  loadingDocument: "Loading document...",
  openNewTab: "Open new tab",
  mini: "Mini",
  max: "Max",
  exportReady: "Export ready",
  exportFailed: "Export failed",
  declarationsAdmin: "Declarations Admin",
  exportCsv: "Export CSV",
  byStation: "By station",
  byPort: "By port",
  invalidDuplicate: "Invalid/Duplicate",
  importNumbers: "Import numbers",
  filter: "Filter",
  all: "All",
  invalidOnly: "Invalid only",
  duplicateOnly: "Duplicate only",
  find: "Find",
  go: "Go",
  swColumn: "SW column",
  swStatus: "SW status",
  auto: "auto",
  every: "every",
  sec: "sec",
  next: "Next",
  legend: "Legend",
  noDeclarationsFound: "No declarations found",
  createNewDecl: "Create a new declaration to get started.",
  createDeclaration: "Create Declaration (Alt+N)",
  declarationDocuments: "Declaration Documents",
  noDocuments: "No documents",
  noFilesUploaded: "No files have been uploaded for this declaration yet.",
  importDeclarationNumbers: "Import Declaration Numbers",
  pasteCsv: "Paste CSV",
  importFailed: "Import failed",
  upload: "Upload",
  summary: "Summary",
};

const AM = {
  failedLoadDeclarations: "መግለጫዎችን መጫን አልተሳካም",
  failedLoadDocuments: "ሰነዶችን መጫን አልተሳካም",
  approveFailed: "ማጽደቅ አልተሳካም",
  rejectionReasonPrompt: "የመክሰስ ምክንያት (አማራጭ)",
  rejectFailed: "መክሰስ አልተሳካም",
  regenerateConfirm: "ለዚህ መዝገብ የመግለጫ ቁጥር እንደገና ይፈጠር?",
  regenerateFailed: "እንደገና ማፍጠር አልተሳካም",
  declarationNoIs: "የመግለጫ ቁጥሩ",
  invalid: "ልክ ያልሆነ",
  duplicate: "የተደጋገመ",
  and: "እና",
  approveAnyway: "ቢሆንም ይፅደቅ?",
  notFound: "አልተገኘም",
  declarationNo: "የመግለጫ ቁጥር",
  date: "ቀን",
  shipment: "ጭነት",
  risk: "አደጋ",
  status: "ሁኔታ",
  actions: "እርምጃዎች",
  documents: "ሰነዶች",
  regenerateNo: "ቁጥር እንደገና ፍጠር",
  approved: "ፀድቋል",
  approve: "ፅድቅ",
  rejected: "ተከስሷል",
  reject: "ክስ",
  title: "ርዕስ",
  file: "ፋይል",
  type: "አይነት",
  size: "መጠን",
  uploaded: "የተጫነበት",
  open: "ክፈት",
  openDocument: "ሰነድ ክፈት",
  documentPreview: "Document Preview",
  selectDocumentToPreview: "Select a document to preview.",
  loadingDocument: "Loading document...",
  openNewTab: "Open new tab",
  mini: "Mini",
  max: "Max",
  exportReady: "ኤክስፖርት ዝግጁ",
  exportFailed: "ኤክስፖርት አልተሳካም",
  declarationsAdmin: "የመግለጫ አስተዳደር",
  exportCsv: "CSV ኤክስፖርት",
  byStation: "በጣቢያ",
  byPort: "በወደብ",
  invalidDuplicate: "ልክ ያልሆነ/የተደጋገመ",
  importNumbers: "ቁጥሮች አስገባ",
  filter: "ማጣሪያ",
  all: "ሁሉም",
  invalidOnly: "ልክ ያልሆኑ ብቻ",
  duplicateOnly: "የተደጋገሙ ብቻ",
  find: "ፈልግ",
  go: "ሂድ",
  swColumn: "SW አምድ",
  swStatus: "SW ሁኔታ",
  auto: "አውቶ",
  every: "በየ",
  sec: "ሰከንድ",
  next: "ቀጣይ",
  legend: "ምልክት መግለጫ",
  noDeclarationsFound: "መግለጫ አልተገኘም",
  createNewDecl: "ለመጀመር አዲስ መግለጫ ይፍጠሩ።",
  createDeclaration: "መግለጫ ፍጠር (Alt+N)",
  declarationDocuments: "የመግለጫ ሰነዶች",
  noDocuments: "ሰነድ የለም",
  noFilesUploaded: "ለዚህ መግለጫ ገና ፋይል አልተጫነም።",
  importDeclarationNumbers: "የመግለጫ ቁጥሮች አስገባ",
  pasteCsv: "CSV ለጥፍ",
  importFailed: "አስገባ አልተሳካም",
  upload: "ጫን",
  summary: "ማጠቃለያ",
};
// SW badges and actions removed from this view to prevent breaks; use the Single Window page








