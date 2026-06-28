import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { ImporterTrackingAPI } from "../api/importerTrackingAPI.js";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { PaymentsAPI } from "../api/paymentAPI.js";
import { InspectionsAPI } from "../api/inspectionAPI.js";
import { ClearancesAPI } from "../api/clearanceAPI.js";
import { ShipmentsAPI } from "../api/shipmentAPI.js";
import { TrackingAPI } from "../api/trackingAPI.js";

function QuickLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: 6, borderRadius: 6, border: '1px solid #ccc', background: '#fafafa', color: '#fff' }}>{label}</button>
  );
}

function bubbleStyle(from) {
  const base = { maxWidth: 640, padding: 10, borderRadius: 8, margin: '6px 0', whiteSpace: 'pre-wrap' };
  if (from === 'user') return { ...base, alignSelf: 'flex-end', background: '#eef5fd', border: '1px solid rgba(0, 209, 255, 0.34)' };
  return { ...base, alignSelf: 'flex-start', background: 'rgba(9, 15, 28, 0.92)', border: '1px solid #e5e7eb' };
}

function replyTo(msg) {
  const q = String(msg || '').trim();
  const low = q.toLowerCase();
  if (/navigate|where|go to|open|find/.test(low)) {
    return {
      text: "Navigation tips:\n- Declarations: create or review import declarations\n- Payments: record and verify duty payments\n- Inspections: schedule and capture results\n- Clearance: record release details\nUse the left sidebar menu or the quick links below.",
      links: [
        { label: 'Declarations', to: '/declarations' },
        { label: 'Payments', to: '/payments' },
        { label: 'Inspections', to: '/inspections' },
        { label: 'Clearance', to: '/clearance' },
        { label: 'Track My Shipment', to: '/my-tracking' },
      ],
    };
  }
  if (/(required|need).*(docs|documents)|document list|what docs/.test(low)) {
    return {
      text: "Common required supporting documents (may vary by goods/policy):\n- Commercial Invoice\n- Packing List\n- Bill of Lading / Air Waybill\n- Certificate of Origin\n- Import License (if applicable)\n- Insurance Policy (if applicable)\n- Any permits for restricted goods\nUpload these files against the declaration via the Documents section in the Declarations page.",
      links: [{ label: 'Go to Declarations', to: '/declarations' }],
    };
  }
  if (/declaration|fill form|how to fill/.test(low)) {
    return {
      text: "Declaration guide:\n1) Create a Shipment (reference, goods, HS code, CIF, ports)\n2) Open Declarations and select the Shipment\n3) Enter declaration no/date, station, currency and tariff\n4) Upload supporting documents\n5) Save, then proceed to Payments when duties are computed",
      links: [
        { label: 'Shipments', to: '/shipments' },
        { label: 'Declarations', to: '/declarations' },
        { label: 'Payments', to: '/payments' },
      ],
    };
  }
  if (/duty|tax|vat|calculate|estimat/.test(low)) {
    const num = (re) => { const m = low.match(re); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
    const usd = num(/usd\s*(\d+(?:[.,]\d+)?)/);
    const rate = num(/rate\s*(\d+(?:[.,]\d+)?)/);
    const cif = num(/cif\s*(\d+(?:[.,]\d+)?)/);
    const tariff = num(/tariff\s*(\d+(?:[.,]\d+)?)/);
    const exc = num(/excise\s*(\d+(?:[.,]\d+)?)/);
    let base = cif;
    if (!isFinite(base) && isFinite(usd) && isFinite(rate)) base = usd * rate;
    if (isFinite(base) && isFinite(tariff)) {
      const duty = (base * tariff) / 100;
      const vat = (base + duty) * 0.15;
      const excise = isFinite(exc) ? exc : 0;
      const total = base + duty + vat + excise;
      const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
      return {
        text: `Estimated duties (ETB):\n- CIF: ${f2(base)}\n- Duty @ ${tariff}%: ${f2(duty)}\n- VAT (15%): ${f2(vat)}\n- Excise: ${f2(excise)}\n= Total Payable: ${f2(total)}\nTip: refine with exact USD x rate or use the Payments page preview.`,
        links: [{ label: 'Open Payments', to: '/payments' }],
      };
    }
    return {
      text: "To estimate duties, provide either:\n- USD and exchange rate and tariff (e.g., \"usd 20000 rate 57.35 tariff 10\")\n- or CIF in ETB and tariff (e.g., \"cif 100000 tariff 10 excise 0\").\nI will compute duty, VAT and total.",
      links: [{ label: 'Payments', to: '/payments' }],
    };
  }
  return {
    text: "Hi! I can help with:\n- Filling declarations\n- Required documents\n- Duty calculation guidance\n- Navigating the system\nType what you need or use quick links below.",
    links: [
      { label: 'Declarations', to: '/declarations' },
      { label: 'Payments', to: '/payments' },
      { label: 'Track My Shipment', to: '/my-tracking' },
    ],
    aiFallback: true,
  };
}

export default function Assistant() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const [msgs, setMsgs] = useState([{ from: 'bot', text: lang === "am" ? "???! ?? ???? ????" : "Hello! How can I help you today?" }]);
  const [input, setInput] = useState("");
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [lastCalc, setLastCalc] = useState({ usd: null, rate: null, cif: null, tariff: null, exc: 0 });
  const [lastList, setLastList] = useState({ which: null, items: [], days: null });
  const [aiLoading, setAiLoading] = useState(false);

  const callAssistantAPI = async (text) => {
    setAiLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
      const tokenRaw = localStorage.getItem('auth');
      const token = tokenRaw ? (JSON.parse(tokenRaw)?.token) : null;
      const history = msgs
        .filter((m) => m.text && (m.from === 'user' || m.from === 'bot'))
        .slice(-6)
        .map((m) => ({ role: m.from === 'bot' ? 'assistant' : 'user', content: m.text }));
      const response = await fetch(`${base}/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'AI service failed');
      }
      return data.answer || "";
    } finally {
      setAiLoading(false);
    }
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q) return;

    const low = q.toLowerCase();
    const mIdx = low.match(/open\s+(?:the\s+)?(first|second|third)/);
    if (mIdx && lastList.items?.length) {
      const idxMap = { first: 0, second: 1, third: 2 };
      const item = lastList.items[idxMap[mIdx[1]]];
      if (item) {
        if (item.onClick) item.onClick();
        else if (item.to) navigate(item.to);
        setMsgs((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: `Opening ${mIdx[1]} ${lastList.which || 'item'}...` }]);
        setInput("");
        setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
        return;
      }
    }

    if (/list my (declarations|payments|inspections|clearances)/.test(low)) {
      try {
        const which = /declarations/.test(low)
          ? 'declarations'
          : /payments/.test(low)
            ? 'payments'
            : /inspections/.test(low)
              ? 'inspections'
              : 'clearances';
        let days = null; const dm = low.match(/last\s+(\d+)\s+days/);
        if (dm) days = Math.max(1, parseInt(dm[1], 10));
        const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
        let items;
        if (which === 'declarations') items = await DeclarationsAPI.list();
        else if (which === 'payments') items = await PaymentsAPI.list();
        else if (which === 'inspections') items = await InspectionsAPI.list();
        else items = await ClearancesAPI.list();
        let arr = Array.isArray(items) ? items : [];
        if (cutoff) {
          const getDate = (it) => (
            which === 'declarations' ? it.declaration_date :
            which === 'payments' ? it.payment_date :
            which === 'inspections' ? it.inspection_date :
            it.release_date
          );
          arr = arr.filter((it) => {
            const d = getDate(it);
            if (!d) return false;
            const dt = new Date(d);
            return !isNaN(dt) && dt >= cutoff;
          });
        }
        const top = arr.slice(0, 5);
        const titles = {
          declarations: 'Your recent declarations',
          payments: 'Your recent payments',
          inspections: 'Your recent inspections',
          clearances: 'Your recent clearances',
        };
        const botTitle = titles[which] || 'Your recent records';
        const chip = (text, color, bg, bd) => ({ text, color, bg, bd });
        const cardItems = top.map((it) => {
          if (which === 'declarations') {
            return {
              label: `${it.declaration_no} ${it.declaration_date ? '('+it.declaration_date+')' : ''}`.trim(),
              to: `/declarations?declaration_id=${encodeURIComponent(it.declaration_id || '')}`,
            };
          }
          if (which === 'payments') {
            const s = String(it.payment_status || '').toLowerCase();
            const chipMap = {
              paid: chip('Paid', '#137333', '#e8f5e9', '#c8e6c9'),
              verified: chip('Verified', '#137333', '#e8f5e9', '#c8e6c9'),
              failed: chip('Failed', '#b00020', '#fdecea', '#f0b4b4'),
              pending: chip('Pending', '#1e3a8a', '#eff6ff', '#0d6efd'),
            };
            return {
              label: `${it.declaration_no || '-'} • ${it.total_payable ?? ''}`.trim(),
              chip: chipMap[s],
              to: it.declaration_id ? `/payments?declaration_id=${encodeURIComponent(it.declaration_id)}` : '/payments',
            };
          }
          if (which === 'inspections') {
            const rc = String(it.risk_channel || '').toLowerCase();
            const rcMap = {
              green: chip('Green', '#137333', '#e8f5e9', '#c8e6c9'),
              yellow: chip('Yellow', '#8a6d3b', '#fff4e5', '#f59e0b'),
              red: chip('Red', '#b00020', '#fdecea', '#f0b4b4'),
            };
            return {
              label: `${it.declaration_no || '-'} • ${it.inspection_result || 'Pending'} ${it.inspection_date || ''}`.trim(),
              chip: rcMap[rc],
              to: it.declaration_id ? `/inspections?declaration_id=${encodeURIComponent(it.declaration_id)}` : '/inspections',
            };
          }
          return {
            label: `${it.declaration_no || '-'} • ${it.release_date || ''} ${it.officer_name ? '[Officer: '+it.officer_name+']' : ''}`.trim(),
            chip: chip('Cleared', '#137333', '#e8f5e9', '#c8e6c9'),
            to: it.declaration_id ? `/clearance?declaration_id=${encodeURIComponent(it.declaration_id)}` : '/clearance',
          };
        });
        const linkMap = {
          declarations: [{ label: 'Open Declarations', to: '/declarations' }, { label: 'View all', to: '/declarations' }],
          payments: [{ label: 'Open Payments', to: '/payments' }, { label: 'View all', to: '/payments' }],
          inspections: [{ label: 'Open Inspections', to: '/inspections' }, { label: 'View all', to: '/inspections' }],
          clearances: [{ label: 'Open Clearances', to: '/clearance' }, { label: 'View all', to: '/clearance' }],
        };
        setMsgs((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: botTitle, items: cardItems, links: linkMap[which] }]);
        setLastList({ which, items: cardItems, days });
      } catch (e) {
        toast?.error?.(e.message || 'Failed to load data');
      }
      setInput("");
      setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
      return;
    }

    if (/list my (tracking|tracking updates)/.test(low)) {
      try {
        const ships = await ShipmentsAPI.list();
        let arr = Array.isArray(ships) ? ships : [];
        let days = null; const dm = low.match(/last\s+(\d+)\s+days/);
        if (dm) days = Math.max(1, parseInt(dm[1], 10));
        const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
        const snaps = await Promise.all(arr.slice(0, 5).map(async (s) => {
          try { const snap = await TrackingAPI.get(s.shipment_id); return { s, snap }; } catch { return { s, snap: null }; }
        }));
        const filtered = snaps.filter(({ snap }) => {
          if (!cutoff) return true;
          const ls = snap?.last_seen ? new Date(snap.last_seen) : null;
          return ls && !isNaN(ls) && ls >= cutoff;
        });
        const cardItems = filtered.map(({ s, snap }) => {
          const loc = (snap?.lat && snap?.lon) ? `${Number(snap.lat).toFixed(3)},${Number(snap.lon).toFixed(3)}` : 'N/A';
          const when = snap?.last_seen ? new Date(snap.last_seen).toLocaleString() : '';
          const eta = snap?.eta_delivery ? new Date(snap.eta_delivery).toLocaleString() : '';
          const cs = snap?.customs_status ? `[${snap.customs_status}]` : '';
          const label = `${s.shipment_reference || '-'} • ${loc} ${when} ${cs} ${eta ? 'ETA '+eta : ''}`.trim();
          return {
            label,
            onClick: () => { try { if (s.shipment_id) localStorage.setItem('tracking.selectedShipmentId', s.shipment_id); } catch {} navigate('/tracking'); },
          };
        });
        setMsgs((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: 'Your recent tracking updates', items: cardItems, links: [{ label: 'Open Tracking', to: '/tracking' }, { label: 'View all', to: '/tracking' }] }]);
        setLastList({ which: 'tracking', items: cardItems, days });
      } catch (e) {
        toast?.error?.(e.message || 'Failed to load tracking');
      }
      setInput("");
      setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
      return;
    }

    if (/(duty|tax|vat|calculate|estimat)/.test(low)) {
      const num = (re) => { const m = low.match(re); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
      let usd = num(/usd\s*(\d+(?:[.,]\d+)?)/);
      let rate = num(/rate\s*(\d+(?:[.,]\d+)?)/);
      let cif = num(/cif\s*(\d+(?:[.,]\d+)?)/);
      let tariff = num(/tariff\s*(\d+(?:[.,]\d+)?)/);
      let exc = num(/excise\s*(\d+(?:[.,]\d+)?)/);
      if (!isFinite(usd)) usd = lastCalc.usd;
      if (!isFinite(rate)) rate = lastCalc.rate;
      if (!isFinite(cif)) cif = lastCalc.cif;
      if (!isFinite(tariff)) tariff = lastCalc.tariff;
      if (!isFinite(exc)) exc = lastCalc.exc;
      let base = cif;
      if (!isFinite(base) && isFinite(usd) && isFinite(rate)) base = usd * rate;
      if (isFinite(base) && isFinite(tariff)) {
        const duty = (base * tariff) / 100;
        const vat = (base + duty) * 0.15;
        const excise = isFinite(exc) ? exc : 0;
        const total = base + duty + vat + excise;
        const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
        setLastCalc({ usd, rate, cif: base, tariff, exc: excise });
        const textOut = `Estimated duties (ETB):\n- CIF: ${f2(base)}\n- Duty @ ${tariff}%: ${f2(duty)}\n- VAT (15%): ${f2(vat)}\n- Excise: ${f2(excise)}\n= Total Payable: ${f2(total)}\nTip: refine inputs or use the Payments page preview.`;
        setMsgs((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: textOut, links: [{ label: 'Open Payments', to: '/payments' }] }]);
        setInput("");
        setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
        return;
      }
    }

    const bot = replyTo(q);
    if (bot.aiFallback) {
      setMsgs((prev) => [...prev, { from: 'user', text: q }]);
      try {
        const answer = await callAssistantAPI(q);
        setMsgs((prev) => [...prev, { from: 'bot', text: answer.length ? answer : 'I could not generate a response.' }]);
      } catch (error) {
        toast?.error?.(error.message || 'AI assistant unavailable');
      }
      setInput("");
      setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
      return;
    }

    setMsgs((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: bot.text, links: bot.links || [] }]);
    setInput("");
    setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
  };

  async function resolveAndNavigate(message) {
    try {
      const low = String(message || '').toLowerCase();
      const mOpen = low.match(/open\s+(payments|payment|inspections?|clearance|declarations?|tracking)/);
      if (!mOpen) return;
      const tokenMatch = message.match(/([A-Z0-9\-\/_]{6,})/i);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) { toast?.warn?.('Please include a reference, e.g., DEC-2025-0001'); return; }
      const resp = await ImporterTrackingAPI.search(token);
      const declId = resp?.declaration?.declaration_id;
      const where = mOpen[1];
      if (where.startsWith('payment')) {
        navigate({ pathname: '/payments', search: declId ? `?declaration_id=${encodeURIComponent(declId)}` : '' });
      } else if (where.startsWith('inspection')) {
        navigate({ pathname: '/inspections', search: declId ? `?declaration_id=${encodeURIComponent(declId)}` : '' });
      } else if (where.startsWith('clearance')) {
        navigate({ pathname: '/clearance', search: declId ? `?declaration_id=${encodeURIComponent(declId)}` : '' });
      } else if (where.startsWith('declaration')) {
        navigate({ pathname: '/declarations', search: declId ? `?declaration_id=${encodeURIComponent(declId)}` : '' });
      } else if (where.startsWith('tracking')) {
        try { if (resp?.shipment?.shipment_id) localStorage.setItem('tracking.selectedShipmentId', resp.shipment.shipment_id); } catch {}
        navigate('/tracking');
      }
    } catch (e) {
      toast?.error?.(e.message || 'Could not resolve reference');
    }
  }

  async function previewWhere(message) {
    try {
      const low = String(message || '').toLowerCase();
      if (!/where\s+is/.test(low)) return;
      const tokenMatch = message.match(/([A-Z0-9\-\/_]{6,})/i);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return;
      const resp = await ImporterTrackingAPI.search(token);
      const d = resp?.declaration; const s = resp?.shipment; const t = resp?.timeline || [];
      const lines = [
        s?.shipment_reference ? `Shipment: ${s.shipment_reference}` : null,
        s?.tracking_ref ? `Tracking: ${s.tracking_ref}` : null,
        d?.declaration_no ? `Declaration: ${d.declaration_no}` : null,
        t.length ? `Status: ${t.find(x => x.status)?.status || t[0].status}` : null,
      ].filter(Boolean).join('\n') || 'No matching shipment found';
      const links = [];
      if (d?.declaration_id) {
        links.push({ label: 'Open Tracking', to: '/tracking' });
        links.push({ label: 'Open Payments', to: `/payments?declaration_id=${encodeURIComponent(d.declaration_id)}` });
      }
      setMsgs((prev) => [...prev, { from: 'bot', text: lines, links }]);
      setTimeout(() => { try { boxRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); } catch {} }, 0);
    } catch (e) { /* silent */ }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('assistant.chat');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMsgs(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('assistant.chat', JSON.stringify(msgs)); } catch {}
  }, [msgs]);

  const quick = useMemo(() => ([
    { label: t.fillDeclarations, text: 'How to fill declaration forms' },
    { label: t.requiredDocuments, text: 'What documents are required?' },
    { label: t.dutyCalculator, text: 'Estimate duty VAT with cif 100000 tariff 10' },
    { label: t.navigationHelp, text: 'Where do I record payments?' },
  ]), []);

  return (
    <div>
      <h2>{t.aiChatAssistant}</h2>
      <div style={{ marginBottom: 8, color: '#6b7280' }}>{t.subtitle}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {quick.map((qk) => (
          <QuickLink key={qk.label} label={qk.label} onClick={() => send(qk.text)} />
        ))}
      </div>
      <div ref={boxRef} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, height: 380, overflow: 'auto', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        {msgs.map((m, idx) => (
          <div key={idx} style={bubbleStyle(m.from)}>
            <div style={{ fontSize: 14 }}>{m.text}</div>
            {m.items && m.items.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {m.items.map((it, i) => (
                  <button key={i} type="button" onClick={() => (it.onClick ? it.onClick() : navigate(it.to))} style={{ display: 'flex', alignItems: 'center', textAlign: 'left', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f8f9fa', color: '#fff' }}>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.chip && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 12, background: it.chip.bg, color: it.chip.color, border: `1px solid ${it.chip.bd}` }}>{it.chip.text}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {m.links && m.links.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {m.links.map((l) => (
                  <QuickLink key={l.label} label={l.label} onClick={() => navigate(l.to)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={async (e) => { e.preventDefault(); const text=input; await send(); await resolveAndNavigate(text); await previewWhere(text); }} style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.typeQuestion} style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 6, background: '#fff', color: '#000' }} />
        <button type="submit" disabled={aiLoading} style={{ padding: '10px 14px' }}>{aiLoading ? t.thinking : t.send}</button>
        <button type="button" onClick={() => { try { localStorage.removeItem('assistant.chat'); } catch {}; setMsgs([{ from: 'bot', text: t.historyClearedPrompt }]); toast?.info?.(t.historyClearedToast); }} style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #f0b4b4', color: '#ffd9e4' }}>{t.clear}</button>
      </form>
    </div>
  );
}

const EN = {
  fillDeclarations: "Fill Declarations",
  requiredDocuments: "Required Documents",
  dutyCalculator: "Duty Calculator",
  navigationHelp: "Navigation Help",
  aiChatAssistant: "AI Chat Assistant",
  subtitle: "Get guidance on declarations, documents, duties and navigation.",
  typeQuestion: "Type your question...",
  thinking: "Thinking...",
  send: "Send",
  clear: "Clear",
  historyClearedPrompt: "History cleared. How can I help?",
  historyClearedToast: "Assistant history cleared",
};

const AM = {
  fillDeclarations: "???? ????",
  requiredDocuments: "????? ????",
  dutyCalculator: "???? ????",
  navigationHelp: "???? ???",
  aiChatAssistant: "AI ??? ???",
  subtitle: "?????? ????? ??? ?? ??? ?? ???? ????",
  typeQuestion: "????? ???...",
  thinking: "???? ??...",
  send: "??",
  clear: "???",
  historyClearedPrompt: "??? ??????? ???? ????",
  historyClearedToast: "???? ??? ??????",
};




