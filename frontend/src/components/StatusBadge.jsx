import React from "react";

export default function StatusBadge({ status }) {
  const s = String(status || "Pending");
  const map = {
    Pending: { bg: "#fff4de", color: "#1e3a8a", border: "#f3d7a6" },
    Accepted: { bg: "#e6f8ee", color: "#0f6a38", border: "#bde8cf" },
    Rejected: { bg: "#ffe9e9", color: "#b00020", border: "#f4c2c2" },
    Initiated: { bg: "#e8efff", color: "#1b4bb3", border: "#c7d6ff" },
    Verified: { bg: "#e5f0ff", color: "#0b4a8a", border: "#b7d4ff" },
    Paid: { bg: "#e6f8ee", color: "#0f6a38", border: "#bde8cf" },
    Failed: { bg: "#ffe9e9", color: "#b00020", border: "#f4c2c2" },
    Passed: { bg: "#e6f8ee", color: "#0f6a38", border: "#bde8cf" },
    Active: { bg: "#e6f8ee", color: "#0f6a38", border: "#bde8cf" },
    Inactive: { bg: "#ffe9e9", color: "#b00020", border: "#f4c2c2" },
  };
  const c = map[s] || { bg: "#f2f4f7", color: "#445", border: "#d7dce4" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {s}
    </span>
  );
}



