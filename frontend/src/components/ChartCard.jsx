import React from "react";

/**
 * ChartCard: wrapper providing title, optional actions, error, and body slot.
 *
 * Props:
 * - title: string
 * - actions: React node (e.g., <ExportActions />)
 * - error: string to show in red
 */
export default function ChartCard({ title, actions, error, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        {actions}
      </div>
      {error && <div style={{ color: "#b00020", fontSize: 12, margin: "4px 0" }}>{error}</div>}
      {children}
    </div>
  );
}


