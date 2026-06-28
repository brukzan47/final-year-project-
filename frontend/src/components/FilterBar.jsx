import React from "react";

/**
 * FilterBar: compact row of filters with optional extra controls.
 *
 * Props:
 * - filters: object with known keys (start, end, search, etc.)
 * - onChange: (key, value) => void
 * - children: render any additional controls on the right
 */
export default function FilterBar({ filters = {}, onChange, children }) {
  const set = (key) => (e) => onChange && onChange(key, e.target.value);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", margin: "8px 0" }}>
      {"start" in filters && (
        <label style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Start</span>
          <input type="date" value={filters.start || ""} onChange={set("start")} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }} />
        </label>
      )}
      {"end" in filters && (
        <label style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>End</span>
          <input type="date" value={filters.end || ""} onChange={set("end")} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }} />
        </label>
      )}
      {"search" in filters && (
        <label style={{ display: "grid", gap: 2, minWidth: 180 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Search</span>
          <input type="text" value={filters.search || ""} onChange={set("search")} placeholder="Type to filter..." style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" }} />
        </label>
      )}
      {children && <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{children}</div>}
    </div>
  );
}

