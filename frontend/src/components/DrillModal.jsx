import React from "react";
import DataTable from "./DataTable.jsx";

/**
 * DrillModal: centered overlay modal for drill-down lists.
 *
 * Props:
 * - open: bool
 * - title: string
 * - onClose: () => void
 * - loading: bool
 * - error: string
 * - columns, rows: passed to DataTable
 * - onRowClick: optional row click handler
 */
export default function DrillModal({ open, title, onClose, loading, error, columns = [], rows = [], onRowClick }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "grid", placeItems: "center", zIndex: 50 }} onClick={onClose}>
      <div
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, width: "90vw", maxWidth: 1000, maxHeight: "80vh", overflow: "auto", boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>Close</button>
        </div>
        {error && <div style={{ color: "#b00020", marginBottom: 6 }}>{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <DataTable columns={columns} rows={rows} dense emptyText="No records" onRowClick={onRowClick} />
        )}
      </div>
    </div>
  );
}

