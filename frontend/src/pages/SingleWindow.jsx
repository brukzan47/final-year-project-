import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { SingleWindowAPI } from "../api/singleWindowAPI.js";
import LeafletMap from "../components/LeafletMap.jsx";
import JsonTree from "../components/JsonTree.jsx";
import DataTable from "../components/DataTable.jsx";
import SandboxPanel from "../components/SandboxPanel.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function SingleWindow() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const routerLocation = useLocation();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [fxF, setFxF] = useState("all");
  const [pmF, setPmF] = useState("all");
  const [trF, setTrF] = useState("all");
  const [sw, setSw] = useState({});
  const [swLoading, setSwLoading] = useState(false);
  const [auto, setAuto] = useState(() => { try { return (localStorage.getItem('sw.auto')||'true')==='true'; } catch { return true; } });
  const [sec, setSec] = useState(() => { try { return Number(localStorage.getItem('sw.sec')||60); } catch { return 60; } });
  const [countdown, setCountdown] = useState(0);
  const [dateFrom, setDateFrom] = useState(() => { try { return localStorage.getItem('sw.dateFrom') || ''; } catch { return ''; } });
  const [dateTo, setDateTo] = useState(() => { try { return localStorage.getItem('sw.dateTo') || ''; } catch { return ''; } });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState({ row: null, fx: null, permit: null, transport: null, events: [] });
  const [evPage, setEvPage] = useState(0);
  const [evPageSize, setEvPageSize] = useState(() => { try { return Number(localStorage.getItem('sw.events.size')||50); } catch { return 50; } });
  const [evTotal, setEvTotal] = useState(0);
  const [evLoading, setEvLoading] = useState(false);
  const [poll, setPoll] = useState(null);

  const load = async () => {
    setErr(""); setLoading(true);
    try { const list = await DeclarationsAPI.list(); setItems(Array.isArray(list) ? list : []); }
    catch (e) { setErr(e.message || t.failedLoad); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  // Initialize search from URL (?q=...)
  useEffect(() => {
    try {
      const p = new URLSearchParams(routerLocation.search);
      const q0 = p.get('q');
      if (q0 !== null) setQ(q0);
    } catch {}
  }, [routerLocation.search]);
  useEffect(() => { try { localStorage.setItem('sw.auto', String(auto)); } catch {} }, [auto]);
  useEffect(() => { try { localStorage.setItem('sw.sec', String(sec)); } catch {} }, [sec]);
  useEffect(() => { try { localStorage.setItem('sw.dateFrom', dateFrom || ''); } catch {} }, [dateFrom]);
  useEffect(() => { try { localStorage.setItem('sw.dateTo', dateTo || ''); } catch {} }, [dateTo]);

  const filtered = useMemo(() => {
    const norm = (v) => (v||'').toString().toLowerCase();
    return (items||[]).filter((d)=>{
      const okQ = !q || norm(d.declaration_no).includes(norm(q)) || norm(d.company_name).includes(norm(q));
      const dt = d.declaration_date ? new Date(d.declaration_date) : null;
      const okFrom = !dateFrom || (dt && dt >= new Date(dateFrom));
      const okTo = !dateTo || (dt && dt <= new Date(dateTo));
      const s = sw[d.declaration_id] || {};
      const fx = (s.fx?.status || '').toLowerCase();
      const pm = (s.permit?.status || '').toLowerCase();
      const tr = (s.transport?.status || '').toLowerCase();
      const okFx = fxF==='all' || fx===fxF;
      const okPm = pmF==='all' || pm===pmF;
      const okTr = trF==='all' || tr===trF;
      return okQ && okFrom && okTo && okFx && okPm && okTr;
    });
  }, [items, q, fxF, pmF, trF, dateFrom, dateTo, sw]);

  const loadSw = async (list) => {
    const rows = Array.isArray(list) ? list : filtered;
    if (!rows.length) return;
    setSwLoading(true);
    try {
      const pairs = await Promise.all(rows.map(async (d) => {
        try { const s = await SingleWindowAPI.get(d.declaration_id); return [d.declaration_id, { fx:s?.fx||null, permit:s?.permit||null, transport:s?.transport||null }]; }
        catch { return [d.declaration_id, { fx:null, permit:null, transport:null }]; }
      }));
      const next = { ...(sw||{}) };
      for (const [k,v] of pairs) next[k]=v;
      setSw(next);
    } finally { setSwLoading(false); }
  };

  useEffect(() => {
    if (!auto || !Number.isFinite(sec) || sec<=0) { setCountdown(0); return; }
    setCountdown(Math.max(10, sec));
    const t = setInterval(()=>{
      setCountdown((c)=>{ const n=(c||0)-1; if (n<=0) { loadSw(); try { SingleWindowAPI.status().then(setPoll).catch(()=>{}); } catch {} return Math.max(10, sec); } return n; });
    }, 1000);
    return ()=> clearInterval(t);
  }, [auto, sec, filtered]);

  const pill = (s) => {
    const v = (s?.status||'').toString();
    let bg='rgba(125, 166, 217, 0.12)', color='#374151';
    const good=/^(approved|issued|linked)$/i.test(v); const bad=/^(rejected|expired|error)$/i.test(v);
    if (good) { bg='#e6ffed'; color='#137333'; } else if (bad) { bg='#fdecea'; color='#b00020'; } else if (v) { bg='#fef08a'; color='#3f2a00'; }
    return (<span style={{ background:bg, color, padding:'2px 6px', borderRadius:12, fontSize:12 }}>{v || '—'}</span>);
  };

  const tableColumns = [
    { key: "declaration_no", label: t.declarationNo },
    { key: "company_name", label: t.importer },
    { key: "shipment_reference", label: t.shipment },
    { key: "fx", label: "FX", render: (d) => pill((sw[d.declaration_id] || {}).fx) },
    { key: "permit", label: t.permit, render: (d) => pill((sw[d.declaration_id] || {}).permit) },
    { key: "transport", label: t.transport, render: (d) => pill((sw[d.declaration_id] || {}).transport) },
    { key: "open", label: t.open, render: (d) => (<button type="button" onClick={()=> openDetails(d)}>{t.details}</button>) },
  ];

  const loadEvents = async (row, page = 0, size = evPageSize) => {
    if (!row?.shipment_id) { setDetails((d)=> ({ ...d, events: [] })); setEvTotal(0); return; }
    setEvLoading(true);
    try {
      const url = `/api/integrations/transport/links/${encodeURIComponent(row.shipment_id)}/events?limit=${encodeURIComponent(size)}&offset=${encodeURIComponent(page*size)}`;
      const r = await fetch(url, { credentials:'include' });
      const data = await r.json();
      if (Array.isArray(data)) { setDetails((d)=> ({ ...d, events: data })); setEvTotal(page*size + data.length); }
      else { setDetails((d)=> ({ ...d, events: Array.isArray(data.items) ? data.items : [] })); setEvTotal(Number(data.total || 0)); }
      setEvPage(page);
    } catch { setDetails((d)=> ({ ...d, events: [] })); }
    finally { setEvLoading(false); }
  };

  const openDetails = async (row) => {
    try {
      setDetails({ row, fx: null, permit: null, transport: null, events: [] });
      setDetailsOpen(true);
      const [fx, pm, tr] = await Promise.all([
        (async ()=> { try { const r = await fetch(`/api/integrations/nbe/fx/approvals/${encodeURIComponent(row.declaration_id)}`, { credentials:'include' }); return await r.json(); } catch { return null; } })(),
        (async ()=> { try { const r = await fetch(`/api/integrations/trade/permits/${encodeURIComponent(row.declaration_id)}`, { credentials:'include' }); return await r.json(); } catch { return null; } })(),
        (async ()=> { try { const r = await fetch(`/api/integrations/transport/links/${encodeURIComponent(row.shipment_id)}`, { credentials:'include' }); return await r.json(); } catch { return null; } })(),
      ]);
      setDetails({ row, fx, permit: pm, transport: tr, events: [] });
      await loadEvents(row, 0, evPageSize);
    } catch (e) {
      alert(e.message || t.failedLoadDetails);
    }
  };

  const copyJson = async (obj, label) => {
    try {
      const text = JSON.stringify(obj || {}, null, 2);
      await navigator.clipboard.writeText(text);
      alert(`${label} ${t.jsonCopied}`);
    } catch (e) {
      try {
        const text = JSON.stringify(obj || {}, null, 2);
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert(`${label} ${t.jsonCopied}`);
      } catch (e2) {
        alert(e2.message || t.copyFailed);
      }
    }
  };

  const exportCsv = () => {
    const rows = filtered.map(d => {
      const s = sw[d.declaration_id] || {};
      return {
        declaration_no: d.declaration_no || '',
        importer: d.company_name || '',
        shipment_reference: d.shipment_reference || '',
        fx_status: s.fx?.status || '',
        fx_ref: s.fx?.request_ref || '',
        permit_status: s.permit?.status || '',
        permit_no: s.permit?.permit_no || '',
        transport_status: s.transport?.status || '',
        transport_ref: s.transport?.provider_ref || '',
      };
    });
    const headers = Object.keys(rows[0]||{ declaration_no:'', importer:'', shipment_reference:'', fx_status:'', fx_ref:'', permit_status:'', permit_no:'', transport_status:'', transport_ref:'' });
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h]??'')).join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `single-window-${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
  };

  return (
    <>
      <div className="single-window-page">
      <h2 className="single-window-title">{t.singleWindow}</h2>
      {err && <div style={{ color:'#b00020', marginBottom:8 }}>{err}</div>}
      <div className="single-window-sandbox">
        <SandboxPanel kicker="" title="Controls" chips={[t.refresh, t.exportCsv, t.serverCsv]}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
        <input placeholder={t.searchPlaceholder} value={q} onChange={(e)=> setQ(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>FX:</span>
        <select value={fxF} onChange={(e)=> setFxF(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }}>
          <option value="all">{t.all}</option>
          <option value="pending">{t.pending}</option>
          <option value="approved">{t.approved}</option>
          <option value="rejected">{t.rejected}</option>
        </select>
        <span style={{ fontSize:12, color:'#6b7280' }}>{t.permit}:</span>
        <select value={pmF} onChange={(e)=> setPmF(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }}>
          <option value="all">{t.all}</option>
          <option value="pending">{t.pending}</option>
          <option value="issued">{t.issued}</option>
          <option value="rejected">{t.rejected}</option>
          <option value="expired">{t.expired}</option>
        </select>
        <span style={{ fontSize:12, color:'#6b7280' }}>{t.transport}:</span>
        <select value={trF} onChange={(e)=> setTrF(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }}>
          <option value="all">{t.all}</option>
          <option value="linked">{t.linked}</option>
          <option value="inactive">{t.inactive}</option>
          <option value="error">{t.error}</option>
        </select>
        <span style={{ width:1, height:18, background:'#ccc' }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>{t.date}:</span>
        <input type="date" value={dateFrom} onChange={(e)=> setDateFrom(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }} />
        <span>{t.to}</span>
        <input type="date" value={dateTo} onChange={(e)=> setDateTo(e.target.value)} style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }} />
        <button type="button" onClick={()=> loadSw(filtered)} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6, background:'#fafafa', color:'#111827' }}>{swLoading ? t.refreshing : t.refresh}</button>
        <label style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input type="checkbox" checked={auto} onChange={(e)=> setAuto(e.target.checked)} /> {t.auto}
        </label>
        <label style={{ display:'flex', gap:6, alignItems:'center' }}>
          {t.every} <input type="number" min="10" step="10" value={sec} onChange={(e)=> setSec(Number(e.target.value)||60)} style={{ width:64, padding:4, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }} /> {t.sec}
        </label>
        {auto && countdown>0 && (<span style={{ fontSize:12, color:'#6b7280' }}>{t.next}: {countdown}s</span>)}
        <span style={{ width:1, height:18, background:'#ccc' }} />
        <button type="button" onClick={exportCsv} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6, background:'#fafafa', color:'#111827' }}>{t.exportCsv}</button>
        {(() => {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (fxF && fxF !== 'all') params.set('fx', fxF);
          if (pmF && pmF !== 'all') params.set('permit', pmF);
          if (trF && trF !== 'all') params.set('transport', trF);
          if (dateFrom) params.set('date_from', dateFrom);
          if (dateTo) params.set('date_to', dateTo);
          const href = `/api/single-window/export.csv${params.toString() ? `?${params.toString()}` : ''}`;
          return (
            <a href={href} target="_blank" rel="noreferrer" style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6, background:'#fafafa', textDecoration:'none', color:'#111827' }}>{t.serverCsv}</a>
          );
        })()}
        <button type="button" onClick={async ()=>{ try { const s = await SingleWindowAPI.status(); setPoll(s); } catch (e) {} }} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6, background:'#fafafa', color:'#111827' }}>{t.pollStatus}</button>
        {poll && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{t.pollers}:</span>
            <span>NBE {poll?.nbe?.enabled ? `@ ${poll?.nbe?.lastRun ? new Date(poll.nbe.lastRun).toLocaleTimeString() : '—'} (${poll?.nbe?.lastUpdated||0})` : 'off'}</span>
            <span>Trade {poll?.trade?.enabled ? `@ ${poll?.trade?.lastRun ? new Date(poll.trade.lastRun).toLocaleTimeString() : '—'} (${poll?.trade?.lastUpdated||0})` : 'off'}</span>
            <span>Transport {poll?.transport?.enabled ? `@ ${poll?.transport?.lastRun ? new Date(poll.transport.lastRun).toLocaleTimeString() : '—'} (${poll?.transport?.lastUpdated||0})` : 'off'}</span>
          </span>
        )}
      </div>
        </SandboxPanel>
      </div>

      <div className="single-window-output">
        <div style={{ overflowX:'auto' }}>
        <DataTable
          columns={tableColumns}
          rows={filtered}
          emptyText={t.noRecords}
          dense
        />
        </div>
      </div>
    {detailsOpen && (
      <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.45)', display:'grid', placeItems:'center', zIndex:1000 }} onClick={()=> setDetailsOpen(false)}>
        <div onClick={(e)=> e.stopPropagation()} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:8, padding:16, width:'min(900px, 96vw)', maxHeight:'90vh', overflow:'auto', boxShadow:'var(--shadow-md)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <strong>{t.singleWindowDetails}</strong>
            <button type="button" onClick={()=> setDetailsOpen(false)}>{t.close}</button>
          </div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>
            {t.declaration}: <strong>{details.row?.declaration_no}</strong> — {t.importer}: <strong>{details.row?.company_name}</strong> — {t.shipment}: <strong>{details.row?.shipment_reference || '-'}</strong>
          </div>
          <div style={{ display:'grid', gap:12 }}>
            <section style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:10 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>{t.fxApproval}</div>
              <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                <button type="button" onClick={()=> copyJson(details.fx, 'FX')}>{t.copyJson}</button>
              </div>
              <div style={preStyle}><JsonTree data={details.fx || {}} defaultOpenDepth={2} /></div>
            </section>
            <section style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:10 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>{t.importPermit}</div>
              <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                <button type="button" onClick={()=> copyJson(details.permit, 'Permit')}>{t.copyJson}</button>
              </div>
              <div style={preStyle}><JsonTree data={details.permit || {}} defaultOpenDepth={2} /></div>
            </section>
            <section style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:10 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>{t.transportLink}</div>
              <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                <button type="button" onClick={()=> copyJson(details.transport, 'Transport')}>{t.copyJson}</button>
              </div>
              <div style={preStyle}>
                <JsonTree data={details.transport || {}} defaultOpenDepth={2} />
              </div>
            </section>
            <section style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:10 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>{t.transportEvents}</div>
              {details.events.length === 0 ? (
                <div style={{ fontSize:12, color:'#6b7280' }}>{t.noEvents}</div>
              ) : (
                <DataTable
                  columns={[
                    { key: "ts", label: t.time },
                    { key: "event_type", label: t.event, render: (e) => e.event_type || '-' },
                    { key: "lat", label: t.lat, render: (e) => e.lat ?? '-' },
                    { key: "lon", label: t.lon, render: (e) => e.lon ?? '-' },
                  ]}
                  rows={details.events}
                  emptyText={t.noEvents}
                  dense
                />
              )}
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                <button type="button" onClick={()=> loadEvents(details.row, Math.max(0, evPage-1), evPageSize)} disabled={evLoading || evPage<=0}>{t.prev}</button>
                <button type="button" onClick={()=> loadEvents(details.row, evPage+1, evPageSize)} disabled={evLoading || (evPage+1)*evPageSize >= evTotal}>{t.next}</button>
                <span style={{ fontSize:12, color:'#6b7280' }}>
                  {t.page} {evPage+1} - {t.showing} {details.events.length} {t.of} {evTotal || "-"}
                </span>
                <label style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {t.size}
                  <select value={evPageSize} onChange={(e)=>{ const s=Number(e.target.value)||50; try{ localStorage.setItem('sw.events.size', String(s)); }catch{}; setEvPageSize(s); loadEvents(details.row, 0, s); }}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button type="button" onClick={()=>{
                  try{
                    const rows = details.events || [];
                    const headers = ['ts','event_type','lat','lon'];
                    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h]??'')).join(','))].join('\n');
                    navigator.clipboard.writeText(csv).then(()=> alert(t.eventsCsvCopied)); 
                  }catch(e){ alert(e.message||t.copyCsvFailed); }
                }}>{t.copyCsv}</button>
                <button type="button" onClick={async ()=>{
                  try{
                    if (!details?.row?.shipment_id) { alert(t.noShipment); return; }
                    const url = `/api/integrations/transport/links/${encodeURIComponent(details.row.shipment_id)}/events.csv`;
                    const r = await fetch(url, { credentials:'include' });
                    const blob = await r.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `events-${details.row.shipment_id}.csv`;
                    a.click();
                    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
                  }catch(e){ alert(e.message||t.downloadFailed); }
                }}>{t.downloadCsv}</button>
              </div>
              {details.events && details.events.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <LeafletMap
                    height={220}
                    center={(() => {
                      const last = details.events[0];
                      return last && isFinite(Number(last.lat)) && isFinite(Number(last.lon)) ? { lat: Number(last.lat), lon: Number(last.lon) } : null;
                    })()}
                    trail={(() => {
                      try {
                        const arr = [...details.events].reverse(); // oldest to newest
                        return arr.filter(e => isFinite(Number(e.lat)) && isFinite(Number(e.lon))).map(e => ({ lat: Number(e.lat), lon: Number(e.lon) }));
                      } catch { return []; }
                    })()}
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    )}
      </div>
    </>
  );
}

const preStyle = { background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:6, padding:8, fontSize:12, overflow:'auto' };

const EN = {
  failedLoad: "Failed to load",
  failedLoadDetails: "Failed to load details",
  jsonCopied: "JSON copied to clipboard",
  copyFailed: "Copy failed",
  singleWindow: "Single Window",
  searchPlaceholder: "Search dec. no or importer",
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  permit: "Permit",
  issued: "Issued",
  expired: "Expired",
  transport: "Transport",
  linked: "Linked",
  inactive: "Inactive",
  error: "Error",
  date: "Date",
  to: "to",
  refreshing: "Refreshing...",
  refresh: "Refresh",
  auto: "Auto",
  every: "every",
  sec: "sec",
  next: "Next",
  exportCsv: "Export CSV",
  serverCsv: "Server CSV",
  pollStatus: "Poll Status",
  pollers: "Pollers",
  noRecords: "No records.",
  declarationNo: "Declaration No",
  importer: "Importer",
  shipment: "Shipment",
  open: "Open",
  details: "Details",
  singleWindowDetails: "Single Window Details",
  close: "Close",
  declaration: "Declaration",
  fxApproval: "FX Approval",
  copyJson: "Copy JSON",
  importPermit: "Import Permit",
  transportLink: "Transport Link",
  transportEvents: "Transport Events",
  noEvents: "No events.",
  time: "Time",
  event: "Event",
  lat: "Lat",
  lon: "Lon",
  prev: "Prev",
  page: "Page",
  showing: "Showing",
  of: "of",
  size: "size",
  copyCsv: "Copy CSV",
  eventsCsvCopied: "Events CSV copied to clipboard",
  copyCsvFailed: "Copy CSV failed",
  noShipment: "No shipment",
  downloadCsv: "Download CSV",
  downloadFailed: "Download failed",
};

const AM = {
  failedLoad: "መጫን አልተሳካም",
  failedLoadDetails: "ዝርዝር መጫን አልተሳካም",
  jsonCopied: "JSON ወደ ክሊፕቦርድ ተቀድቷል",
  copyFailed: "መቅዳት አልተሳካም",
  singleWindow: "ነጠላ መስኮት",
  searchPlaceholder: "የመግለጫ ቁጥር ወይም አስመጪ ይፈልጉ",
  all: "ሁሉም",
  pending: "በመጠባበቅ ላይ",
  approved: "ፀድቋል",
  rejected: "ተከስሷል",
  permit: "ፈቃድ",
  issued: "ተሰጥቷል",
  expired: "ጊዜው አልፏል",
  transport: "ትራንስፖርት",
  linked: "ተያይዟል",
  inactive: "ንቁ አይደለም",
  error: "ስህተት",
  date: "ቀን",
  to: "እስከ",
  refreshing: "በማደስ ላይ...",
  refresh: "አድስ",
  auto: "አውቶ",
  every: "በየ",
  sec: "ሰከንድ",
  next: "ቀጣይ",
  exportCsv: "CSV ኤክስፖርት",
  serverCsv: "የሰርቨር CSV",
  pollStatus: "የPoll ሁኔታ",
  pollers: "Pollers",
  noRecords: "መዝገብ የለም።",
  declarationNo: "የመግለጫ ቁጥር",
  importer: "አስመጪ",
  shipment: "ጭነት",
  open: "ክፈት",
  details: "ዝርዝር",
  singleWindowDetails: "የነጠላ መስኮት ዝርዝር",
  close: "ዝጋ",
  declaration: "መግለጫ",
  fxApproval: "የFX ፍቃድ",
  copyJson: "JSON ቅዳ",
  importPermit: "የአስመጪ ፈቃድ",
  transportLink: "የትራንስፖርት ግንኙነት",
  transportEvents: "የትራንስፖርት ክስተቶች",
  noEvents: "ክስተት የለም።",
  time: "ሰዓት",
  event: "ክስተት",
  lat: "ኬክሮስ",
  lon: "ኬንትሮስ",
  prev: "ቀዳሚ",
  page: "ገጽ",
  showing: "የሚታዩ",
  of: "ከ",
  size: "መጠን",
  copyCsv: "CSV ቅዳ",
  eventsCsvCopied: "የክስተት CSV ወደ ክሊፕቦርድ ተቀድቷል",
  copyCsvFailed: "CSV መቅዳት አልተሳካም",
  noShipment: "ጭነት የለም",
  downloadCsv: "CSV አውርድ",
  downloadFailed: "ማውረድ አልተሳካም",
};





