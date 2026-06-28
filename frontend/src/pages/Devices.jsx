import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrackingAPI } from "../api/trackingAPI.js";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import DataTable from "../components/DataTable.jsx";
import ExportActions from "../components/ExportActions.jsx";

export default function Devices() {
  const toast = useToast();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const tx = lang === "am" ? AM : EN;
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyFilter, setCompanyFilter] = useState(() => { try { return localStorage.getItem('devices.filter.company') || ""; } catch { return ""; } });
  const [statusFilter, setStatusFilter] = useState(() => { try { return localStorage.getItem('devices.filter.status') || "all"; } catch { return "all"; } }); // all | online | offline
  const [onlineOnly, setOnlineOnly] = useState(() => { try { return (localStorage.getItem('devices.filter.onlineOnly') || 'false') === 'true'; } catch { return false; } });
  const [autoRefresh, setAutoRefresh] = useState(() => { try { return (localStorage.getItem('devices.auto') || 'true') === 'true'; } catch { return true; } });
  const [refreshSec, setRefreshSec] = useState(() => { try { return Number(localStorage.getItem('devices.auto.sec') || 60); } catch { return 60; } });
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sortKey, setSortKey] = useState(() => { try { return localStorage.getItem('devices.sort.key') || ''; } catch { return ''; } });
  const [sortDir, setSortDir] = useState(() => { try { return localStorage.getItem('devices.sort.dir') || 'asc'; } catch { return 'asc'; } });
  const [f, set] = useState({ device_id: "", shipment_id: "", container_no: "", transport_company: "", driver_name: "", driver_phone: "", active: true });
  const [exporting, setExporting] = useState(false);

  const on = (e) => set({ ...f, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const downloadCsv = async () => {
    try {
      setExporting(true);
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch('/api/export/devices.csv', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `devices.csv`; a.click();
      URL.revokeObjectURL(url);
      toast?.success(tx.devicesExported);
    } catch (e) {
      toast?.error?.(e.message || tx.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  const load = async () => {
    setErr("");
    setListLoading(true);
    try { const list = await TrackingAPI.devices.list(); setItems(Array.isArray(list) ? list : []); }
    catch (e) { setErr(e.message || tx.failedLoadDevices); }
    finally {
      try { setLastRefreshedAt(new Date()); } catch {}
      setListLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Persist filters
  useEffect(() => { try { localStorage.setItem('devices.filter.company', companyFilter || ''); } catch {} }, [companyFilter]);
  useEffect(() => { try { localStorage.setItem('devices.filter.status', statusFilter || 'all'); } catch {} }, [statusFilter]);
  useEffect(() => { try { localStorage.setItem('devices.filter.onlineOnly', String(onlineOnly)); } catch {} }, [onlineOnly]);
  useEffect(() => { try { localStorage.setItem('devices.auto', String(autoRefresh)); } catch {} }, [autoRefresh]);
  useEffect(() => { try { localStorage.setItem('devices.auto.sec', String(refreshSec)); } catch {} }, [refreshSec]);
  useEffect(() => { try { localStorage.setItem('devices.sort.key', sortKey || ''); } catch {} }, [sortKey]);
  useEffect(() => { try { localStorage.setItem('devices.sort.dir', sortDir || 'asc'); } catch {} }, [sortDir]);

  // Auto refresh countdown
  useEffect(() => {
    if (!autoRefresh || !Number.isFinite(refreshSec) || refreshSec <= 0) { setCountdown(0); return; }
    setCountdown(Math.max(5, refreshSec));
    const t = setInterval(() => {
      setCountdown((c) => {
        const next = (c || 0) - 1;
        if (next <= 0) { load(); return Math.max(5, refreshSec); }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [autoRefresh, refreshSec]);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (!f.device_id) throw new Error(tx.deviceIdRequired);
      await TrackingAPI.devices.create(f);
      toast?.success(tx.deviceSaved);
      set({ device_id: "", shipment_id: "", container_no: "", transport_company: "", driver_name: "", driver_phone: "", active: true });
      await load();
    } catch (e2) { setErr(e2.message || tx.failedSaveDevice); } finally { setLoading(false); }
  };

  const filteredSorted = useMemo(() => {
    return items
      .filter(d => {
        const okCompany = !companyFilter || String(d.transport_company || '').toLowerCase().includes(companyFilter.toLowerCase());
        const okStatus = statusFilter === 'all' || (statusFilter === 'online' ? d.online : !d.online);
        const okToggle = !onlineOnly || d.online;
        return okCompany && okStatus && okToggle;
      })
      .sort((a,b) => sortDevices(a,b,sortKey,sortDir));
  }, [items, companyFilter, statusFilter, onlineOnly, sortKey, sortDir]);

  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir('asc'); return key; }
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
      return prev;
    });
  };

  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const columns = useMemo(() => ([
    { key: "device_id", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('device_id')}>{tx.deviceId}{arrow('device_id')}</span>, render: (d) => d.device_id },
    { key: "shipment_id", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('shipment_id')}>{tx.shipmentId}{arrow('shipment_id')}</span>, render: (d)=> d.shipment_id || '-' },
    { key: "container_no", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('container_no')}>{tx.container}{arrow('container_no')}</span>, render: (d)=> d.container_no || '-' },
    { key: "transport_company", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('transport_company')}>{tx.company}{arrow('transport_company')}</span>, render: (d)=> d.transport_company || '-' },
    { key: "driver_name", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('driver_name')}>{tx.driver}{arrow('driver_name')}</span>, render: (d)=> d.driver_name || '-' },
    { key: "driver_phone", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('driver_phone')}>{tx.phone}{arrow('driver_phone')}</span>, render: (d)=> d.driver_phone || '-' },
    { key: "active", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('active')}>{tx.active}{arrow('active')}</span>, render: (d)=> d.active ? tx.yes : tx.no },
    {
      key: "last_seen",
      label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('last_seen')}>{tx.lastSeen}{arrow('last_seen')}</span>,
      render: (d) => {
        if (!d.last_seen) return '-';
        const minutes = typeof d.minutes_since_last === 'number' ? d.minutes_since_last : null;
        let color = '#6c757d', bg = '#f8f9fa';
        if (minutes != null) {
          if (minutes <= 30) { bg = '#e6ffed'; color = '#137333'; }
          else if (minutes <= 120) { bg = '#eff6ff'; color = '#1e3a8a'; }
          else { bg = '#fdecea'; color = '#b00020'; }
        }
        return (
          <span style={{ background: bg, color, padding: '2px 6px', borderRadius: 4 }}>
            {d.last_seen} {minutes != null ? `(${minutes}${tx.minAgo})` : ''}
          </span>
        );
      }
    },
    {
      key: "online",
      label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('online')}>{tx.status}{arrow('online')}</span>,
      render: (d) => d.online ? (
        <span style={{ background: '#e6ffed', color: '#137333', padding: '2px 6px', borderRadius: 4 }}>{tx.online}</span>
      ) : (
        <span style={{ background: '#eff6ff', color: '#1e3a8a', padding: '2px 6px', borderRadius: 4 }}>{tx.offline}{typeof d.minutes_since_last === 'number' ? ` (${d.minutes_since_last}${tx.min})` : ''}</span>
      )
    },
    { key: "registered_at", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('registered_at')}>{tx.registered}{arrow('registered_at')}</span>, render: (d)=> d.registered_at || '-' },
    { key: "destination_port", label: <span style={{ cursor:'pointer' }} onClick={()=> toggleSort('destination_port')}>{tx.dest}{arrow('destination_port')}</span>, render: (d)=> d.destination_port || '-' },
    {
      key: "map",
      label: tx.destMap,
      render: (d) => {
        const lat = d.dest_lat ?? d.lat;
        const lon = d.dest_lon ?? d.lon;
        return (d.destination_port && lat && lon) ? (
          <a href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`} target="_blank" rel="noreferrer">{tx.map}</a>
        ) : '-';
      }
    },
    {
      key: "actions",
      label: tx.actions,
      render: (d) => (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={()=> navigate({ pathname:'/tracking', search: d.shipment_id ? ('?shipment_id='+encodeURIComponent(d.shipment_id)) : '' })}>{tx.track}</button>
        </span>
      )
    },
  ]), [navigate, sortKey, sortDir]);

  return (
    <div className="devices-page-shell">
      <div className="devices-page-panel">
        <div className="devices-page-section devices-page-section--summary">
          <div className="devices-page-section-head">
            <div>
              <div className="devices-page-kicker">{tx.gpsDevices}</div>
              <h2 className="devices-page-title">{tx.gpsDevices}</h2>
            </div>
          </div>
          {err && <div className="devices-page-error">{err}</div>}
          <div className="devices-page-toolbar">
            <span className="devices-page-label">{tx.onlineLabel}</span>
            <OnlineCounter items={items} />
            <span className="devices-page-divider" />
            <span className="devices-page-label">{tx.filterLabel}</span>
            <input className="devices-page-input" placeholder={tx.companyPlaceholder} value={companyFilter} onChange={(e)=> setCompanyFilter(e.target.value)} />
            <select className="devices-page-select" value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value)}>
              <option value="all">{tx.all}</option>
              <option value="online">{tx.online}</option>
              <option value="offline">{tx.offline}</option>
            </select>
            <label className="devices-page-check">
              <input type="checkbox" checked={onlineOnly} onChange={(e)=> setOnlineOnly(e.target.checked)} /> {tx.showOnlineOnly}
            </label>
            <button type="button" onClick={() => {
              setCompanyFilter(''); setStatusFilter('all'); setOnlineOnly(false);
              try { localStorage.removeItem('devices.filter.company'); localStorage.removeItem('devices.filter.status'); localStorage.removeItem('devices.filter.onlineOnly'); } catch {}
            }} className="devices-page-button">{tx.clearFilters}</button>
            <ExportActions actions={[
              { label: exporting ? tx.exporting : tx.exportCsv, disabled: exporting, onClick: downloadCsv }
            ]} />
            <span className="devices-page-divider" />
            <button type="button" onClick={() => { load(); setCountdown(Math.max(5, refreshSec)); }} className="devices-page-button devices-page-button--refresh">
              {listLoading ? (<><Spinner size={14} /> {tx.refreshing}</>) : tx.refresh}
            </button>
            <label className="devices-page-check">
              <input type="checkbox" checked={autoRefresh} onChange={(e)=> setAutoRefresh(e.target.checked)} /> {tx.autoRefresh}
            </label>
            <label className="devices-page-check">
              {tx.every} <input type="number" min="5" step="5" value={refreshSec} onChange={(e)=> setRefreshSec(Number(e.target.value) || 60)} className="devices-page-number" /> {tx.sec}
            </label>
            {lastRefreshedAt && (
              <span className="devices-page-meta">{tx.last}: {lastRefreshedAt.toLocaleTimeString()}</span>
            )}
            {autoRefresh && countdown > 0 && (
              <span className="devices-page-meta">{tx.next}: {countdown}s</span>
            )}
          </div>
        </div>

        <div className="devices-page-section devices-page-section--register">
          <div className="devices-page-section-head devices-page-section-head--tight">
            <div>
              <div className="devices-page-kicker">{tx.registerUpdate}</div>
              <h3 className="devices-page-subtitle">{tx.registerUpdate}</h3>
            </div>
          </div>
          <form onSubmit={submit} className="device-register-form">
            <label className="device-register-field">
              <span>{tx.deviceId}</span>
              <input name="device_id" value={f.device_id} onChange={on} placeholder="DEV-123" />
            </label>
            <label className="device-register-field">
              <span>{tx.shipmentIdOptional}</span>
              <input name="shipment_id" value={f.shipment_id} onChange={on} placeholder="UUID" />
            </label>
            <label className="device-register-field">
              <span>{tx.containerOptional}</span>
              <input name="container_no" value={f.container_no} onChange={on} placeholder="MSCU1234567" />
            </label>
            <div className="device-register-grid">
              <label className="device-register-field">
                <span>{tx.transportCompany}</span>
                <input name="transport_company" value={f.transport_company} onChange={on} placeholder="XYZ Logistics" />
              </label>
              <label className="device-register-field">
                <span>{tx.driverName}</span>
                <input name="driver_name" value={f.driver_name} onChange={on} placeholder="Alemu" />
              </label>
            </div>
            <div className="device-register-grid">
              <label className="device-register-field">
                <span>{tx.driverPhone}</span>
                <input name="driver_phone" value={f.driver_phone} onChange={on} placeholder="+2519..." />
              </label>
              <label className="device-register-check">
                <input type="checkbox" name="active" checked={!!f.active} onChange={on} /> {tx.active}
              </label>
            </div>
            <div>
              <button type="submit" disabled={loading}>{loading ? tx.saving : tx.save}</button>
            </div>
          </form>
        </div>

        <div className="devices-page-section devices-page-section--table">
          <div className="devices-page-table-wrap">
            <DataTable
              columns={columns}
              rows={filteredSorted}
              emptyText={tx.noDevices}
              dense
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OnlineCounter({ items }) {
  const { online, total } = useMemo(() => {
    try {
      const t = Array.isArray(items) ? items.length : 0;
      const on = Array.isArray(items) ? items.filter((d) => d.online).length : 0;
      return { online: on, total: t };
    } catch { return { online: 0, total: 0 }; }
  }, [items]);
  const pct = total ? Math.round((online / total) * 100) : 0;
  const color = online ? '#137333' : '#6c757d';
  const bg = online ? '#e6ffed' : '#f8f9fa';
  return (
    <span style={{ background: bg, color, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
      {online} / {total} ({pct}%)
    </span>
  );
}

function val(d, key) {
  switch (key) {
    case 'active': return d.active ? 1 : 0;
    case 'online': return d.online ? 1 : 0;
    case 'last_seen': return d.minutes_since_last != null ? -Number(d.minutes_since_last) : (d.last_seen ? new Date(d.last_seen).getTime() : -Infinity);
    case 'registered_at': return d.registered_at ? new Date(d.registered_at).getTime() : 0;
    default: return (d[key] || '').toString().toLowerCase();
  }
}

function sortDevices(a, b, key, dir) {
  if (!key) return 0;
  const va = val(a, key); const vb = val(b, key);
  if (va === vb) return 0;
  const asc = dir !== 'desc';
  return (va > vb ? 1 : -1) * (asc ? 1 : -1);
}

function Spinner({ size = 14 }) {
  const s = Math.max(10, Number(size) || 14);
  const stroke = Math.max(2, Math.round(s / 7));
  const r = (s - stroke) / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label="loading" style={{ display: 'inline-block' }}>
      <circle cx={s/2} cy={s/2} r={r} stroke="#0d6efd" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${Math.PI*r}, ${Math.PI*r*2}`}>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${s/2} ${s/2}`} to={`360 ${s/2} ${s/2}`} dur="0.9s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

const EN = {
  gpsDevices: "GPS Devices", onlineLabel: "Online:", filterLabel: "Filter:", companyPlaceholder: "Company...",
  all: "All", online: "Online", offline: "Offline", showOnlineOnly: "Show Online Only", clearFilters: "Clear Filters",
  exporting: "Exporting...", exportCsv: "Export CSV", refreshing: "Refreshing...", refresh: "Refresh",
  autoRefresh: "Auto-refresh", every: "every", sec: "sec", last: "Last", next: "Next",
  registerUpdate: "Register / Update Device", deviceId: "Device ID", shipmentId: "Shipment ID", shipmentIdOptional: "Shipment ID (optional)",
  container: "Container", containerOptional: "Container No (optional)", company: "Company", driver: "Driver", phone: "Phone",
  active: "Active", yes: "Yes", no: "No", lastSeen: "Last Seen", minAgo: "m ago", min: "m",
  status: "Status", registered: "Registered", dest: "Dest", destMap: "Dest Map", map: "Map", actions: "Actions", track: "Track",
  transportCompany: "Transport Company", driverName: "Driver Name", driverPhone: "Driver Phone", saving: "Saving...", save: "Save",
  noDevices: "No devices.", devicesExported: "Devices CSV exported", exportFailed: "Export failed",
  failedLoadDevices: "Failed to load devices", deviceIdRequired: "device_id is required", deviceSaved: "Device saved", failedSaveDevice: "Failed to save device",
};

const AM = {
  gpsDevices: "የGPS መሳሪያዎች", onlineLabel: "በመስመር ላይ:", filterLabel: "ማጣሪያ:", companyPlaceholder: "ኩባንያ...",
  all: "ሁሉም", online: "በመስመር ላይ", offline: "ከመስመር ውጭ", showOnlineOnly: "በመስመር ላይ ብቻ አሳይ", clearFilters: "ማጣሪያ አጥፋ",
  exporting: "በማውጣት ላይ...", exportCsv: "CSV አውጣ", refreshing: "በማደስ ላይ...", refresh: "አድስ",
  autoRefresh: "ራስ-ሰር አድስ", every: "እያንዳንዱ", sec: "ሰከንድ", last: "መጨረሻ", next: "ቀጣይ",
  registerUpdate: "መሳሪያ መመዝገብ / ማዘመን", deviceId: "የመሳሪያ ID", shipmentId: "የጭነት ID", shipmentIdOptional: "የጭነት ID (አማራጭ)",
  container: "ኮንቴይነር", containerOptional: "የኮንቴይነር ቁጥር (አማራጭ)", company: "ኩባንያ", driver: "ሾፌር", phone: "ስልክ",
  active: "ንቁ", yes: "አዎ", no: "አይ", lastSeen: "መጨረሻ ታይቷል", minAgo: "ደቂቃ በፊት", min: "ደ",
  status: "ሁኔታ", registered: "ተመዝግቧል", dest: "መድረሻ", destMap: "የመድረሻ ካርታ", map: "ካርታ", actions: "እርምጃዎች", track: "ክትትል",
  transportCompany: "የትራንስፖርት ኩባንያ", driverName: "የሾፌር ስም", driverPhone: "የሾፌር ስልክ", saving: "በማስቀመጥ ላይ...", save: "አስቀምጥ",
  noDevices: "መሳሪያ የለም።", devicesExported: "የመሳሪያ CSV ተወጥቷል", exportFailed: "ማውጣት አልተሳካም",
  failedLoadDevices: "መሳሪያዎችን መጫን አልተሳካም", deviceIdRequired: "device_id ያስፈልጋል", deviceSaved: "መሳሪያ ተቀምጧል", failedSaveDevice: "መሳሪያ ማስቀመጥ አልተሳካም",
};




