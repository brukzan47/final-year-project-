import React from "react";

/**
 * DataTable: lightweight table with sticky header/hover support.
 *
 * Props:
 * - columns: [{ key, label, align, render }]
 * - rows: array of objects
 * - emptyText: string when no rows
 * - onRowClick: (row) => void
 * - rowStyle: (row, index) => style object
 * - rowClassName: (row, index) => string
 * - rowRef: (row, index) => ref object (optional)
 * - dense: boolean to tighten padding
 */
export default function DataTable({ columns = [], rows = [], emptyText = "No data", onRowClick, dense, rowStyle, rowClassName, rowRef }) {
  const cellPad = dense ? "6px 6px" : "8px 6px";
  return (
    <table className="table-sticky table-hover smart-table smart-table--stack" style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={i}
              style={{
                textAlign: c.align || "left",
                borderBottom: "1px solid #e5e7eb",
                padding: cellPad,
                fontWeight: 600,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(rows || []).length === 0 && (
          <tr>
            <td style={{ padding: cellPad, color: "#6b7280" }} colSpan={columns.length}>{emptyText}</td>
          </tr>
        )}
        {(rows || []).map((r, ri) => (
          <tr
            key={ri}
            ref={rowRef ? rowRef(r, ri) : undefined}
            className={[onRowClick ? "row-click" : null, rowClassName ? rowClassName(r, ri) : null].filter(Boolean).join(" ") || undefined}
            style={rowStyle ? rowStyle(r, ri) : undefined}
            onClick={() => onRowClick && onRowClick(r)}
          >
            {columns.map((c, ci) => (
              <td
                key={ci}
                data-label={c.label}
                style={{
                  padding: cellPad,
                  borderBottom: "1px solid #eff6ff",
                  textAlign: c.align || "left",
                  fontSize: dense ? 12 : 14,
                }}
              >
                {c.render ? c.render(r, ri) : r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
