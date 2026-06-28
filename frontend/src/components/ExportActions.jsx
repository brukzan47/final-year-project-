import React from "react";

/**
 * ExportActions: group of small action buttons (e.g., PDF/CSV).
 *
 * Props:
 * - actions: [{ label, onClick, disabled, title }]
 */
export default function ExportActions({ actions = [] }) {
  if (!actions.length) return null;
  return (
    <div className="export-actions">
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          disabled={a.disabled}
          title={a.title}
          className="export-btn"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
