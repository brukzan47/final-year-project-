import React, { useState } from "react";

function Entry({ k, v, depth, defaultOpenDepth }) {
  const isObject = v !== null && typeof v === 'object';
  const [open, setOpen] = useState(depth < defaultOpenDepth);

  if (!isObject) {
    return (
      <div style={{ marginLeft: depth ? 12 : 0 }}>
        {k !== null && <span style={{ color: '#6b7280' }}>{k}: </span>}
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', whiteSpace: 'pre-wrap' }}>
          {String(v)}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(v);
  const keys = isArray ? v.map((_, i) => i) : Object.keys(v || {});
  const label = k !== null
    ? `${k} ${isArray ? `[${keys.length}]` : `{${keys.length}}`}`
    : isArray ? `Array[${keys.length}]` : `Object{${keys.length}}`;

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={{ marginLeft: depth ? 12 : 0 }}>
      <summary style={{ cursor: 'pointer' }}>{label}</summary>
      <div>
        {keys.map((key) => (
          <Entry
            key={key}
            k={String(key)}
            v={isArray ? v[key] : v[key]}
            depth={depth + 1}
            defaultOpenDepth={defaultOpenDepth}
          />
        ))}
      </div>
    </details>
  );
}

export default function JsonTree({ data, defaultOpenDepth = 1 }) {
  return (
    <div className="prewrap" style={{ fontSize: 12 }}>
      <Entry k={null} v={data} depth={0} defaultOpenDepth={defaultOpenDepth} />
    </div>
  );
}



