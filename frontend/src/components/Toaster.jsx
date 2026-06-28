import React from "react";
import { useToast } from "../context/ToastContext.jsx";

export default function Toaster() {
  const toast = useToast();
  const items = toast?._list || [];
  const styles = {
    pos: { position: 'fixed', top: 12, right: 12, display: 'grid', gap: 8, zIndex: 9999 },
    card: (type) => {
      const map = {
        success: { bg: '#e6ffed', bd: 'rgba(57, 245, 193, 0.35)', color: '#88ffdc' },
        error: { bg: '#fdecea', bd: '#f0b4b4', color: '#b00020' },
        info: { bg: '#e3f2fd', bd: '#bbdefb', color: '#d6fbff' },
        warn: { bg: '#fef08a', bd: '#facc15', color: '#3f2a00' },
      };
      const m = map[type] || map.info;
      return { background: m.bg, border: `1px solid ${m.bd}`, color: m.color, padding: '10px 12px', borderRadius: 8, minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'start', gap: 10, backdropFilter: 'blur(8px)' };
    },
    close: { marginLeft: 'auto', background: 'transparent', border: 'none', color: '#a6c4eb', cursor: 'pointer' },
  };
  return (
    <div style={styles.pos}>
      {items.map((t) => (
        <div key={t.id} style={styles.card(t.type)}>
          <div style={{ fontSize: 14 }} className="prewrap">{t.msg}</div>
          <button onClick={() => toast.remove(t.id)} style={styles.close} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}


