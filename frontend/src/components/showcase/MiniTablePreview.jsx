import React from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function MiniTablePreview({ columns = [], rows = [] }) {
  return (
    <div className="showcase-table-wrap">
      <table className="showcase-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => {
                const value = row[column] ?? row[column.toLowerCase()] ?? "-";
                const isStatus = column.toLowerCase().includes("status") || column.toLowerCase().includes("risk") || column.toLowerCase().includes("role");
                return <td key={column}>{isStatus ? <StatusBadge tone={row.tone || "success"}>{value}</StatusBadge> : value}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
