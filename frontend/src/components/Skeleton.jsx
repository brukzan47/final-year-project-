import React from "react";

export function Skeleton({ width = '100%', height = 12, radius = 6, style = {} }) {
  return <div className="skeleton-shimmer" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonText({ lines = 3, lineHeight = 12, gap = 8, width = '100%' }) {
  const arr = Array.from({ length: lines });
  return (
    <div style={{ display: 'grid', gap }}>
      {arr.map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : width} height={lineHeight} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  const r = Array.from({ length: rows });
  const c = Array.from({ length: cols });
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 0, borderBottom: '1px solid var(--color-border)' }}>
        {c.map((_, i) => (
          <div key={i} style={{ padding: 10, fontWeight: 600 }}><Skeleton width="60%" height={10} /></div>
        ))}
      </div>
      {r.map((_, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {c.map((_, ci) => (
            <div key={ci} style={{ padding: 10, borderTop: '1px solid var(--color-border)' }}>
              <Skeleton width={`${60 + ((ci * 10) % 30)}%`} height={10} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

