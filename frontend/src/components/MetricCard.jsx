import React from "react";

/**
 * MetricCard: small stat card with title, value, delta badge, and optional helper.
 *
 * Props: title, value, delta (string), deltaTone ("up" | "down" | "neutral"), helper, tooltip
 */
export default function MetricCard({ title, value, delta, deltaTone = "neutral", helper, tooltip, children }) {
  const toneColor = deltaTone === "up" ? "#16a34a" : deltaTone === "down" ? "#dc2626" : "#6b7280";
  return (
    <div className="card metric-card" style={{ padding: 12 }} title={tooltip || undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="metric-card-title" style={{ fontSize: 12 }}>{title}</div>
        {delta && (
          <span style={{ fontSize: 11, color: toneColor, fontWeight: 600 }}>{delta}</span>
        )}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{value}</div>
      {helper && <div className="metric-card-helper" style={{ fontSize: 12 }}>{helper}</div>}
      {children}
    </div>
  );
}


