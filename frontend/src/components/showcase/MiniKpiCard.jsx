import React from "react";
import { AppIcon } from "../IconStore.jsx";

export default function MiniKpiCard({ icon = "analytics", label, value, delta, tone = "green" }) {
  return (
    <div className={`showcase-kpi showcase-tone-${tone}`}>
      <span className="showcase-kpi-icon"><AppIcon name={icon} size={18} /></span>
      <div>
        <div className="showcase-kpi-label">{label}</div>
        <div className="showcase-kpi-value">{value}</div>
        <div className="showcase-kpi-delta">{delta}</div>
      </div>
    </div>
  );
}
