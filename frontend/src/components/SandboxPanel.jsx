import React from "react";

/**
 * SandboxPanel: reusable highlighted card for experimental or future features.
 *
 * Props:
 * - kicker: small label above/next to the title (e.g., "Sandbox")
 * - title: main heading text
 * - chips: array of pill labels
 * - children: body content
 */
export default function SandboxPanel({ kicker = "Sandbox", title = "Future-ready space", chips = [], children }) {
  return (
    <div className="sandbox-panel">
      <div className="sandbox-header">
        {kicker && <span className="sandbox-kicker">{kicker}</span>}
        <span>{title}</span>
      </div>
      {children && <div className="sandbox-body">{children}</div>}
      {chips?.length > 0 && (
        <div className="sandbox-actions">
          {chips.map((chip, i) => (
            <span key={i} className="sandbox-chip">{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}
