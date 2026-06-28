import React from "react";

function normalizeRiskChannel(channel) {
  const low = String(channel || "Green").trim().toLowerCase();
  if (low === "red") return "Red";
  if (low === "yellow") return "Yellow";
  return "Green";
}

function riskTone(channel) {
  const c = normalizeRiskChannel(channel);
  if (c === "Red") return { bg: "#b42318", color: "#fff", border: "#e59a95" };
  if (c === "Yellow") return { bg: "#facc15", color: "#111827", border: "#fde047" };
  return { bg: "#15803d", color: "#fff", border: "#74c69d" };
}

export default function RiskBadge({ channel = "Green", score }) {
  const c = normalizeRiskChannel(channel);
  const t = riskTone(c);
  const scoreText = Number.isFinite(Number(score)) ? ` (${Number(score)})` : "";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {c}{scoreText}
    </span>
  );
}



