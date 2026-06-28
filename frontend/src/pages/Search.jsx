import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SmartAPI } from "../api/smartAPI.js";
import { DocumentsAPI } from "../api/documentAPI.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { SkeletonText } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import DataTable from "../components/DataTable.jsx";
import SmartSearchTable from "../components/SmartSearchTable.jsx";

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const tx = lang === "am" ? AM : EN;
  const [q, setQ] = useState("");
  const [types, setTypes] = useState({ declaration: true, shipment: true, importer: false, document: false, device: false, tracking: false });
  const [items, setItems] = useState([]);
  const [byType, setByType] = useState(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(() => { try { return (localStorage.getItem('smart.search.help')||'false')==='true'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('smart.search.help', String(showHelp)); } catch {} }, [showHelp]);
  useEffect(() => {
    const onKey = (e) => {
      try {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        const inField = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
        if (!inField && (e.key === 'h' || e.key === 'H')) { setShowHelp(v=>!v); }
      } catch {}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [declStatus, setDeclStatus] = useState("");
  const [station, setStation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [copying, setCopying] = useState(false);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smart.saved') || '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('smart.saved', JSON.stringify(saved||[])); } catch {} }, [saved]);

  const openDocument = async (documentId) => {
    try {
      const blob = await DocumentsAPI.downloadFile(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e.message || "Failed to open document");
    }
  };

  // Initialize from URL
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const q0 = p.get('q'); if (q0 !== null) setQ(q0);
      const t0 = (p.get('types')||'').split(',').filter(Boolean);
      if (t0.length) {
        setTypes({
          declaration: t0.includes('declaration'),
          shipment: t0.includes('shipment'),
          importer: t0.includes('importer'),
          document: t0.includes('document'),
          device: t0.includes('device'),
          tracking: t0.includes('tracking'),
        });
      }
      const get = (k) => p.get(k) || '';
      setOrigin(get('origin'));
      setDestination(get('destination'));
      setDeclStatus(get('decl_status'));
      setStation(get('station'));
      setFrom(get('date_from'));
      setTo(get('date_to'));
      const pg = Number(p.get('page')||'1')||1; setPage(pg);
      const sz = Number(p.get('size')||'50')||50; setSize(sz);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildParams = (pg = page, sz = size) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const t = Object.entries(types).filter(([,v])=>v).map(([k])=>k);
    if (t.length) params.set('types', t.join(','));
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    if (declStatus) params.set('decl_status', declStatus);
    if (station) params.set('station', station);
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    params.set('page', String(pg));
    params.set('size', String(sz));
    return params;
  };

  const run = async (pg = page) => {
    setLoading(true);
    try {
      const t = Object.entries(types).filter(([,v])=>v).map(([k])=>k);
      const res = await SmartAPI.search({ q, types: t, page: pg, size, origin, destination, decl_status: declStatus, station, date_from: from, date_to: to });
      if (Array.isArray(res)) { setItems(res); setTotal(res.length); setByType(null); }
      else { setItems(Array.isArray(res?.items) ? res.items : []); setTotal(Number(res?.total || 0)); setPage(Number(res?.page || pg)); setSize(Number(res?.size || size)); setByType(res?.byType || null); }
      // Update URL for shareable state
      try { navigate({ search: buildParams(pg, size).toString() }, { replace: true }); } catch {}
    } catch (e) { alert(e.message || tx.searchFailed); }
    finally { setLoading(false); }
  };
  useEffect(() => { /* optional: load defaults */ }, []);
  return (
    <div className="search-page">
      <div className="search-page__sandbox">
        <h2 className="search-page__title">{tx.smartSearch}</h2>
        <div className="search-page__controls">
        <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder={tx.searchPlaceholder} style={{ padding:8, border:'1px solid #ccc', borderRadius:6, minWidth:280, background:'#fff', color:'#000' }} />
        <button type="button" title={tx.searchHelp} onClick={()=> setShowHelp(v=>!v)} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6 }}>?</button>
        <label><input type="checkbox" checked={types.declaration} onChange={(e)=> setTypes({ ...types, declaration: e.target.checked })} /> {tx.declarations}</label>
        <label><input type="checkbox" checked={types.shipment} onChange={(e)=> setTypes({ ...types, shipment: e.target.checked })} /> {tx.shipments}</label>
        <label><input type="checkbox" checked={types.importer} onChange={(e)=> setTypes({ ...types, importer: e.target.checked })} /> {tx.importers}</label>
        <label><input type="checkbox" checked={types.document} onChange={(e)=> setTypes({ ...types, document: e.target.checked })} /> {tx.documents}</label>
        <label><input type="checkbox" checked={types.device} onChange={(e)=> setTypes({ ...types, device: e.target.checked })} /> {tx.devices}</label>
        <label><input type="checkbox" checked={types.tracking} onChange={(e)=> setTypes({ ...types, tracking: e.target.checked })} /> {tx.tracking}</label>
        {/* Facets */}
                <span style={{ width:1, height:18, background:'#ccc' }} />
        <button type="button" onClick={()=>{
          const name = window.prompt('Save as (name):', q || new Date().toISOString().slice(0,19));
          if (!name) return;
          const t = Object.entries(types).filter(([,v])=>v).map(([k])=>k);
          const entry = { name, q, types: t, origin, destination, declStatus, station, from, to };
          setSaved((prev)=> [entry, ...prev.filter(s=> s.name!==name)].slice(0,20));
        }} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6 }}>Save</button>
        {saved.length>0 && (
          <>
            <select onChange={(e)=>{
              const sel = saved.find(s=> s.name===e.target.value);
              if (!sel) return;
              setQ(sel.q||'');
              setTypes({
                declaration: !!(sel.types||[]).includes('declaration'),
                shipment: !!(sel.types||[]).includes('shipment'),
                importer: !!(sel.types||[]).includes('importer'),
                document: !!(sel.types||[]).includes('document'),
                device: !!(sel.types||[]).includes('device'),
                tracking: !!(sel.types||[]).includes('tracking'),
              });
              setOrigin(sel.origin||''); setDestination(sel.destination||''); setDeclStatus(sel.declStatus||''); setStation(sel.station||''); setFrom(sel.from||''); setTo(sel.to||'');
              run(1);
            }} defaultValue="" style={{ padding:6, border:'1px solid #ccc', borderRadius:6, background:'#fff', color:'#000' }}>
              <option value="" disabled>Saved…</option>
              {saved.map(s=> (<option key={s.name} value={s.name}>{s.name}</option>))}
            </select>
            <button type="button" onClick={()=>{
              const name = window.prompt('Delete which saved search? Enter name:');
              if (!name) return;
              setSaved((prev)=> prev.filter(s=> s.name!==name));
            }} style={{ padding:'4px 8px', border:'1px solid #ccc', borderRadius:6 }}>Delete Saved</button>
          </>
        )}<span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>{tx.total}: {total}</span>
        {byType && (
          <span style={{ fontSize: 12, color: '#6b7280', display:'inline-flex', gap:8 }}>
            <button type="button" onClick={()=>{ setTypes({ declaration:true, shipment:false, importer:false, document:false, device:false, tracking:false }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Dec {byType.declaration||0}</button>
            <button type="button" onClick={()=>{ setTypes({ declaration:false, shipment:true, importer:false, document:false, device:false, tracking:false }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Shp {byType.shipment||0}</button>
            <button type="button" onClick={()=>{ setTypes({ declaration:false, shipment:false, importer:true, document:false, device:false, tracking:false }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Imp {byType.importer||0}</button>
            <button type="button" onClick={()=>{ setTypes({ declaration:false, shipment:false, importer:false, document:true, device:false, tracking:false }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Doc {byType.document||0}</button>
            <button type="button" onClick={()=>{ setTypes({ declaration:false, shipment:false, importer:false, document:false, device:true, tracking:false }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Dev {byType.device||0}</button>
            <button type="button" onClick={()=>{ setTypes({ declaration:false, shipment:false, importer:false, document:false, device:false, tracking:true }); run(1); }} style={{ padding:'2px 8px', border:'1px solid #ccc', borderRadius:999 }}>Trk {byType.tracking||0}</button>
          </span>
        )}
        </div>
        {showHelp && (
        <div className="search-page__help">
          <div style={{ fontWeight:600, marginBottom:6 }}>{tx.smartSearchHelp}</div>
          <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.6 }}>
            <div>{tx.prefixes}</div>
            <ul>
              <li><code>dec:</code> Declaration No (e.g., dec:DEC-ET-2025-00001)</li>
              <li><code>ref:</code> Shipment Reference (e.g., ref:SHP-20251113-ABCD)</li>
              <li><code>trk:</code> Tracking Ref (e.g., trk:176-12345678)</li>
              <li><code>hs:</code> HS Code (e.g., hs:8517)</li>
              <li><code>imp:</code> Importer Name (e.g., imp:"Abebe PLC")</li>
              <li><code>doc:</code> Document file name (e.g., doc:invoice.pdf)</li>
              <li><code>dev:</code> Device ID (e.g., dev:DEV-123)</li>
            </ul>
            <div>{tx.facets}</div>
            <ul>
              <li>Origin (Shipments): country name (partial match)</li>
              <li>Dest (Shipments): destination port (partial match)</li>
              <li>Decl Status / Station (Declarations): partial match</li>
              <li>Date From / To: filters by created/uploaded dates</li>
            </ul>
            <div>{tx.tips}</div>
            <ul>
              <li>Use type toggles to limit entities. Exact matches are boosted.</li>
              <li>Use pagination controls below to navigate results.</li>
            </ul>
          </div>
        </div>
      )}
        <ResultsTable
          items={items}
          loading={loading}
          query={q}
          onQueryChange={setQ}
          onSearch={run}
          filters={{ start: from, end: to }}
          onFilterChange={(k, v) => {
            if (k === 'start') setFrom(v);
            if (k === 'end') setTo(v);
          }}
          emptyText={tx.noResults}
        />
        <div className="search-page__footer">
          <button type="button" onClick={()=> run(Math.max(1, page-1))} disabled={page<=1 || loading}>{tx.prev}</button>
          <button type="button" onClick={()=> run(page+1)} disabled={loading || (page*size)>=total}>{tx.next}</button>
          <span style={{ fontSize:12, color:'#6b7280' }}>{tx.page} {page} - {tx.showing} {items.length} {tx.of} {total}</span>
          <label style={{ display:'flex', gap:6, alignItems:'center' }}>
            {tx.size}
            <select value={size} onChange={(e)=> { const s = Number(e.target.value)||50; setSize(s); run(1); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ items, loading, query, onQueryChange, onSearch, filters, onFilterChange, actions, emptyText }) {
  const rows = items.map((it) => ({ it, m: it.meta || {}, type: it.entity_type || it.type || 'unknown' }));

  const columns = [
    { key: "type", label: "Type", render: (r) => r.type },
    {
      key: "key",
      label: "Key",
      render: (r) => {
        const { it, m, type: t } = r;
        if (t === 'declaration') return (<a href={`/declarations?declaration_id=${encodeURIComponent(it.entity_id)}`}>{m.declaration_no || it.entity_id}</a>);
        if (t === 'shipment') return m.shipment_reference || it.entity_id;
        if (t === 'importer') return m.company_name || it.entity_id;
        if (t === 'document') return m.title || it.entity_id;
        if (t === 'device') return m.device_id || it.entity_id;
        if (t === 'tracking') return m.shipment_id || it.entity_id;
        return it.entity_id;
      }
    },
    {
      key: "col1",
      label: "Col 1",
      render: (r) => {
        const { it, m, type: t } = r;
        if (t === 'declaration') return m.status || '-';
        if (t === 'shipment') return m.tracking_ref || '-';
        if (t === 'importer') return m.tin_number || '-';
        if (t === 'document') return m.file_name || '-';
        if (t === 'device') return m.transport_company || '-';
        if (t === 'tracking') return m.vessel_name || '-';
        return it.text || '-';
      }
    },
    {
      key: "col2",
      label: "Col 2",
      render: (r) => {
        const { it, m, type: t } = r;
        if (t === 'declaration') return m.customs_station || '-';
        if (t === 'shipment') return m.hs_code || '-';
        if (t === 'importer') return m.contact_email || '-';
        if (t === 'document') return m.file_type || '-';
        if (t === 'device') return m.driver_name || '-';
        if (t === 'tracking') return (<span className="prewrap">{it.text}</span>);
        return '-';
      }
    },
    {
      key: "col3",
      label: "Col 3",
      render: (r) => {
        const { m, type: t } = r;
        if (t === 'declaration') return m.shipment_reference || '-';
        if (t === 'shipment') return m.destination_port || '-';
        if (t === 'device') return m.container_no || '-';
        return '-';
      }
    },
    {
      key: "col4",
      label: "Col 4",
      render: (r) => {
        const { m, type: t } = r;
        if (t === 'declaration') return m.importer || '-';
        return '-';
      }
    },
    {
      key: "open",
      label: "Open",
      render: (r) => {
        const { it, m, type: t } = r;
        if (t === 'declaration') return (<a href={`/declarations?declaration_id=${encodeURIComponent(it.entity_id)}`} title="Open Declaration">Open</a>);
        if (t === 'shipment') return (<a href={`/tracking?shipment_id=${encodeURIComponent(it.entity_id)}`} title="Open Tracking">Track</a>);
        if (t === 'importer') return (<a href={`/importers`} title="Open Importers">Open</a>);
        if (t === 'document') return it.entity_id ? (<button type="button" onClick={() => openDocument(it.entity_id)} title="Open document">Open</button>) : '-';
        if (t === 'device') return m.shipment_id ? (<a href={`/tracking?shipment_id=${encodeURIComponent(m.shipment_id)}`} title="Open Tracking">Track</a>) : (<a href={`/devices`} title="Open GPS Devices">Open</a>);
        if (t === 'tracking') return m.shipment_id ? (<a href={`/tracking?shipment_id=${encodeURIComponent(m.shipment_id)}`} title="Open Tracking">Open</a>) : '-';
        return '-';
      }
    },
  ];

  return (
    <SmartSearchTable
      query={query}
      onQueryChange={onQueryChange}
      onSearch={onSearch}
      filters={filters}
      onFilterChange={onFilterChange}
      actions={actions}
      columns={columns}
      rows={rows}
      loading={loading}
      emptyText={emptyText || "No results"}
    />
  );
}

const EN = {
  smartSearch: "Smart Search",
  searchPlaceholder: "Search declarations, shipments...",
  searchHelp: "Search help",
  declarations: "Declarations",
  shipments: "Shipments",
  importers: "Importers",
  documents: "Documents",
  devices: "Devices",
  tracking: "Tracking",
  total: "Total",
  smartSearchHelp: "Smart Search Help",
  prefixes: "Prefixes (exact where applicable):",
  facets: "Facets:",
  tips: "Tips:",
  prev: "Prev",
  next: "Next",
  page: "Page",
  showing: "Showing",
  of: "of",
  size: "size",
  noResults: "No results",
  searchFailed: "Search failed",
};

const AM = {
  smartSearch: "ብልህ ፍለጋ",
  searchPlaceholder: "መግለጫ፣ ጭነት... ፈልግ",
  searchHelp: "የፍለጋ እገዛ",
  declarations: "መግለጫዎች",
  shipments: "ጭነቶች",
  importers: "አስመጪዎች",
  documents: "ሰነዶች",
  devices: "መሳሪያዎች",
  tracking: "ክትትል",
  total: "ጠቅላላ",
  smartSearchHelp: "የብልህ ፍለጋ እገዛ",
  prefixes: "ቅድመ ቅጥያዎች (ትክክለኛ):",
  facets: "ፊልተሮች:",
  tips: "ምክሮች:",
  prev: "ቀዳሚ",
  next: "ቀጣይ",
  page: "ገጽ",
  showing: "በማሳየት ላይ",
  of: "ከ",
  size: "መጠን",
  noResults: "ውጤት የለም",
  searchFailed: "ፍለጋ አልተሳካም",
};


