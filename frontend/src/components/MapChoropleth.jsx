import React, { useMemo } from "react";

// Lightweight SVG world map via external topojson would need a lib. To avoid new deps,
// use a simplified SVG with a few key regions. For full map, consider react-simple-maps.

// Minimal placeholder: renders a horizontal bar map-like visualization by country code.
// It isn't a geographic projection, but provides a quick visual distribution.

export default function MapChoropleth({ data }) {
  // data: [{ country: 'China', shipments: 12, total_cif: 100000 }]
  const rows = Array.isArray(data) ? data : [];
  const max = useMemo(() => rows.reduce((m, r) => Math.max(m, Number(r.total_cif)||0), 0) || 1, [rows]);
  const palette = ["#1b314e", "#21456d", "#245f94", "#2279ba", "#2d7fd3", "#3d8cde", "#4d99e8", "#0d6efd"];
  const colorFor = (v) => {
    const idx = Math.min(palette.length - 1, Math.floor((Number(v||0)/max) * (palette.length - 1)));
    return palette[idx];
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 90px', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#334155' }}>{r.country}</div>
          <div style={{ background: 'rgba(125, 166, 217, 0.16)', borderRadius: 4, height: 12 }}>
            <div style={{ width: `${Math.min(100, (Number(r.total_cif)/max)*100)}%`, height: 12, borderRadius: 4, background: colorFor(r.total_cif) }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>ETB {Number(r.total_cif||0).toLocaleString()}</div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>No country data</div>}
    </div>
  );
}

