import React, { useEffect, useMemo, useState } from "react";
import { LocationAPI } from "../api/locationAPI.js";
import Modal from "../components/Modal.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import DataTable from "../components/DataTable.jsx";
import ExportActions from "../components/ExportActions.jsx";

export default function Locations() {
  const toast = useToast();
  const { lang } = useLanguage();
  const tx = lang === "am" ? AM : EN;
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [f, set] = useState({ name: "", type: "", lat: "", lon: "" });
  const [editing, setEditing] = useState(null); // name
  const [edit, setEdit] = useState({ name: "", type: "", lat: "", lon: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('name,type,lat,lon\n');
  const typeOptions = ["port","dry_port","border","city"];
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

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
      toast?.success(`${tx.exportReady}: ${filename}`);
    } catch (e) {
      toast?.error?.(e.message || tx.exportFailed);
    }
  };

  const load = async () => {
    setErr("");
    try { const list = await LocationAPI.list(); setItems(Array.isArray(list) ? list : []); }
    catch (e) { setErr(e.message || tx.failedLoad); }
  };
  useEffect(() => { load(); }, []);
  const filteredItems = items.filter(r => {
    const q = (filter||'').toLowerCase();
    if (!q) return true;
    return (r.name||'').toLowerCase().includes(q) || (r.type||'').toLowerCase().includes(q);
  });
  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a,b)=>{
      const ka = sortKey;
      const va = a[ka]; const vb = b[ka];
      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;
      if (ka === 'lat' || ka === 'lon') {
        const na = Number(va), nb = Number(vb);
        return (na === nb ? 0 : (na > nb ? 1 : -1)) * dir;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa === sb) return 0; return (sa > sb ? 1 : -1) * dir;
    });
    return arr;
  }, [filteredItems, sortKey, sortDir]);

  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir('asc'); return key; }
      setSortDir((d)=> d === 'asc' ? 'desc' : 'asc');
      return prev;
    });
  };

  const columns = useMemo(() => ([
    {
      key: "name",
      label: tx.name,
      render: (r) => editing === r.name ? (
        <input value={edit.name} onChange={(e)=> setEdit({ ...edit, name: e.target.value })} />
      ) : r.name
    },
    {
      key: "type",
      label: tx.type,
      render: (r) => editing === r.name ? (
        <select value={edit.type||''} onChange={(e)=> setEdit({ ...edit, type: e.target.value })}>
          <option value="">(none)</option>
          {typeOptions.map(t=> (<option key={t} value={t}>{t}</option>))}
        </select>
      ) : (r.type || '-')
    },
    {
      key: "lat",
      label: tx.lat,
      render: (r) => editing === r.name ? (
        <input value={edit.lat} onChange={(e)=> setEdit({ ...edit, lat: e.target.value })} />
      ) : r.lat
    },
    {
      key: "lon",
      label: tx.lon,
      render: (r) => editing === r.name ? (
        <input value={edit.lon} onChange={(e)=> setEdit({ ...edit, lon: e.target.value })} />
      ) : r.lon
    },
    {
      key: "actions",
      label: tx.actions,
      render: (r) => editing === r.name ? (
        <>
          <button type="button" onClick={saveEdit} disabled={loading} style={{ marginRight:6 }}>{tx.save}</button>
          <button type="button" onClick={()=> setEditing(null)} disabled={loading}>{tx.cancel}</button>
        </>
      ) : (
        <>
          <button type="button" onClick={()=> startEdit(r)} style={{ marginRight:6 }}>{tx.edit}</button>
          <button type="button" onClick={()=> remove(r.name)} disabled={loading} style={{ marginRight:6 }}>{tx.delete}</button>
          {isFinite(Number(r.lat)) && isFinite(Number(r.lon)) && (
            <>
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(r.lat)},${encodeURIComponent(r.lon)}`} target="_blank" rel="noreferrer" style={{ marginRight:6 }}>{tx.openMap}</a>
              <a href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(r.lat)}&mlon=${encodeURIComponent(r.lon)}#map=12/${encodeURIComponent(r.lat)}/${encodeURIComponent(r.lon)}`} target="_blank" rel="noreferrer">{tx.openOsm}</a>
            </>
          )}
        </>
      )
    },
  ]), [editing, edit, loading, typeOptions]);

  const add = async () => {
    setErr(""); setLoading(true);
    try {
      if (!f.name) throw new Error(tx.nameRequired);
      if (f.type && !typeOptions.includes(f.type)) throw new Error(tx.invalidType);
      const payload = { ...f, lat: Number(f.lat), lon: Number(f.lon) };
      await LocationAPI.create(payload);
      set({ name: "", type: "", lat: "", lon: "" });
      await load();
      toast?.success(tx.locationAdded);
    } catch (e) { setErr(e.message || tx.createFailed); }
    finally { setLoading(false); }
  };

  const startEdit = (row) => {
    setEditing(row.name);
    setEdit({ name: row.name, type: row.type || "", lat: row.lat, lon: row.lon });
  };
  const saveEdit = async () => {
    setErr(""); setLoading(true);
    try {
      if (edit.type && !typeOptions.includes(edit.type)) throw new Error(tx.invalidType);
      await LocationAPI.update(editing, { new_name: edit.name, type: edit.type || null, lat: Number(edit.lat), lon: Number(edit.lon) });
      setEditing(null);
      await load();
      toast?.success(tx.locationUpdated);
    } catch (e) { setErr(e.message || tx.updateFailed); }
    finally { setLoading(false); }
  };
  const remove = async (name) => {
    if (!window.confirm(`${tx.deletePrompt} ${name}?`)) return;
    setErr(""); setLoading(true);
    try { await LocationAPI.remove(name); await load(); toast?.success(tx.locationRemoved); }
    catch (e) { setErr(e.message || tx.deleteFailed); }
    finally { setLoading(false); }
  };
  const bulkDelete = async () => {
    if (filteredItems.length === 0) return;
    const proceed = window.confirm(`${tx.deleteFilteredPrompt} ${filteredItems.length}?`);
    if (!proceed) return;
    setErr(""); setLoading(true);
    try {
      for (const r of filteredItems) {
        try { await LocationAPI.remove(r.name); } catch {}
      }
      await load();
      toast?.success(tx.filteredDeleted);
    } catch (e) { setErr(e.message || tx.bulkDeleteFailed); }
    finally { setLoading(false); }
  };

  return (
    <div className="locations-page-shell">
      <div className="locations-page-panel">
        <div className="locations-page-heading">
          <div className="locations-page-kicker">Customs</div>
          <h2>{tx.locations}</h2>
        </div>

        {err && <div className="locations-page-error">{err}</div>}

        <div className="locations-page-form">
          <input placeholder={tx.name} value={f.name} onChange={(e)=> set({ ...f, name: e.target.value })} />
          <select value={f.type} onChange={(e)=> set({ ...f, type: e.target.value })}>
            <option value="">{tx.typePlaceholder}</option>
            {typeOptions.map(t=> (<option key={t} value={t}>{t}</option>))}
          </select>
          <input placeholder={tx.lat} value={f.lat} onChange={(e)=> set({ ...f, lat: e.target.value })} />
          <input placeholder={tx.lon} value={f.lon} onChange={(e)=> set({ ...f, lon: e.target.value })} />
          <button type="button" onClick={add} disabled={loading}>{tx.add}</button>
          <ExportActions actions={[
            { label: tx.downloadCsv, onClick: () => downloadCsv('locations.csv', '/api/locations/csv') }
          ]} />
          <button type="button" onClick={()=> setImportOpen(true)}>{tx.importCsv}</button>
        </div>

        <div className="locations-page-tools">
          <input value={filter} onChange={(e)=> setFilter(e.target.value)} placeholder={tx.filterByNameType} />
          <button type="button" onClick={async ()=>{
            try {
              const headers = {};
              if (token) headers["Authorization"] = `Bearer ${token}`;
              const res = await fetch('/api/locations/csv', { credentials:'include', headers });
              const text = await res.text();
              await navigator.clipboard.writeText(text);
              toast?.success(tx.csvCopied);
            } catch (e) { alert(e.message || tx.copyFailed); }
          }}>{tx.copyCsv}</button>
          <button type="button" onClick={bulkDelete} disabled={loading || filteredItems.length===0}>{tx.deleteFiltered}</button>
        </div>

        <div className="locations-page-tableWrap">
        <DataTable
          columns={columns}
          rows={sortedItems}
          emptyText={tx.noLocations}
          dense
        />
        </div>
      </div>

      <Modal open={importOpen} title={tx.importLocationsCsv} onClose={()=> setImportOpen(false)}>
        <div className="locations-import-panel">
          <div className="locations-import-help">{tx.pasteCsvHeader}</div>
          <textarea rows={8} value={importText} onChange={(e)=> setImportText(e.target.value)} />
          <div>
            <button type="button" onClick={async ()=>{
              try {
                setErr(""); setLoading(true);
                const res = await LocationAPI.importCsv(importText);
                toast?.success(`${tx.imported}: ok=${res?.summary?.ok||0}, fail=${res?.summary?.fail||0}`);
                setImportOpen(false);
                await load();
              } catch (e) { alert(e.message || tx.importFailed); }
              finally { setLoading(false); }
            }}>{tx.upload}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const EN = {
  locations: "Locations", exportReady: "Export ready", exportFailed: "Export failed", failedLoad: "Failed to load locations",
  name: "Name", type: "Type", lat: "Lat", lon: "Lon", actions: "Actions", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete",
  openMap: "Open Map", openOsm: "Open OSM", nameRequired: "Name required", invalidType: "Invalid type", locationAdded: "Location added",
  createFailed: "Create failed", locationUpdated: "Location updated", updateFailed: "Update failed", deletePrompt: "Delete",
  locationRemoved: "Location removed", deleteFailed: "Delete failed", deleteFilteredPrompt: "Delete filtered location(s)", filteredDeleted: "Filtered locations deleted",
  bulkDeleteFailed: "Bulk delete failed", typePlaceholder: "Type...", add: "Add", downloadCsv: "Download CSV", importCsv: "Import CSV",
  filterByNameType: "Filter by name/type...", csvCopied: "Locations CSV copied", copyFailed: "Copy failed", copyCsv: "Copy CSV",
  deleteFiltered: "Delete Filtered", noLocations: "No locations.", importLocationsCsv: "Import Locations CSV",
  pasteCsvHeader: "Paste CSV with header: name,type,lat,lon", imported: "Imported", importFailed: "Import failed", upload: "Upload",
};

const AM = {
  locations: "á‰¦á‰³á‹Žá‰½", exportReady: "áˆ›á‹áŒ« á‹áŒáŒ áŠá‹", exportFailed: "áˆ›á‹áŒ£á‰µ áŠ áˆá‰°áˆ³áŠ«áˆ", failedLoad: "á‰¦á‰³á‹Žá‰½áŠ• áˆ˜áŒ«áŠ• áŠ áˆá‰°áˆ³áŠ«áˆ",
  name: "áˆµáˆ", type: "áŠ á‹­áŠá‰µ", lat: "áŠ¬áŠ­áˆ®áˆµ", lon: "áŠ¬áŠ•á‰µáˆ®áˆµ", actions: "áŠ¥áˆ­áˆáŒƒá‹Žá‰½", save: "áŠ áˆµá‰€áˆáŒ¥", cancel: "áˆ°áˆ­á‹", edit: "áŠ áˆ­á‰µá‹•", delete: "áˆ°áˆ­á‹",
  openMap: "áŠ«áˆ­á‰³ áŠ­áˆá‰µ", openOsm: "OSM áŠ­áˆá‰µ", nameRequired: "áˆµáˆ á‹«áˆµáˆáˆáŒ‹áˆ", invalidType: "á‹¨á‰°áˆ³áˆ³á‰° áŠ á‹­áŠá‰µ", locationAdded: "á‰¦á‰³ á‰°áŒ¨áˆáˆ¯áˆ",
  createFailed: "áˆ˜ááŒ áˆ­ áŠ áˆá‰°áˆ³áŠ«áˆ", locationUpdated: "á‰¦á‰³ á‰°á‹˜áˆáŠ—áˆ", updateFailed: "áˆ›á‹˜áˆ˜áŠ• áŠ áˆá‰°áˆ³áŠ«áˆ", deletePrompt: "áˆ°áˆ­á‹",
  locationRemoved: "á‰¦á‰³ á‰°áˆ°áˆ­á‹Ÿáˆ", deleteFailed: "áˆ˜áˆ°áˆ¨á‹ áŠ áˆá‰°áˆ³áŠ«áˆ", deleteFilteredPrompt: "á‹¨á‰°áŒ£áˆ© á‰¦á‰³á‹Žá‰½áŠ• áˆ°áˆ­á‹", filteredDeleted: "á‹¨á‰°áŒ£áˆ© á‰¦á‰³á‹Žá‰½ á‰°áˆ°áˆ­á‹˜á‹‹áˆ",
  bulkDeleteFailed: "á‹¨áŒ…áˆáˆ‹ áˆ˜áˆ°áˆ¨á‹ áŠ áˆá‰°áˆ³áŠ«áˆ", typePlaceholder: "áŠ á‹­áŠá‰µ...", add: "áŒ¨áˆáˆ­", downloadCsv: "CSV áŠ á‹áˆ­á‹µ", importCsv: "CSV áŠ áˆµáŒˆá‰£",
  filterByNameType: "á‰ áˆµáˆ/áŠ á‹­áŠá‰µ áŠ áŒ£áˆ«...", csvCopied: "á‹¨á‰¦á‰³ CSV á‰°á‰€á‹µá‰·áˆ", copyFailed: "áˆ˜á‰…á‹³á‰µ áŠ áˆá‰°áˆ³áŠ«áˆ", copyCsv: "CSV á‰…á‹³",
  deleteFiltered: "á‹¨á‰°áŒ£áˆ©áŠ• áˆ°áˆ­á‹", noLocations: "á‰¦á‰³ á‹¨áˆˆáˆá¢", importLocationsCsv: "á‹¨á‰¦á‰³á‹Žá‰½ CSV áŠ áˆµáŒˆá‰£",
  pasteCsvHeader: "áˆ«áˆµáŒŒá‹ name,type,lat,lon á‹«áˆˆá‹áŠ• CSV á‹­áˆˆáŒ¥á‰", imported: "áŠ áˆµáŒˆá‰£", importFailed: "áˆ›áˆµáŒˆá‰£á‰µ áŠ áˆá‰°áˆ³áŠ«áˆ", upload: "áŒ«áŠ•",
};


