import React from "react";
import DataTable from "./DataTable.jsx";
import FilterBar from "./FilterBar.jsx";

/**
 * SmartSearchTable
 * Bundles search + optional filters + table with loading/empty states.
 *
 * Props:
 * - query: string
 * - onQueryChange: (value) => void
 * - onSearch: () => void
 * - filters: object for FilterBar (optional)
 * - onFilterChange: (key, value) => void (optional)
 * - actions: React node for extra buttons (optional)
 * - columns: DataTable columns
 * - rows: DataTable rows
 * - loading: bool
 * - emptyText: string
 */
export default function SmartSearchTable({
  query = "",
  onQueryChange,
  onSearch,
  filters,
  onFilterChange,
  actions,
  columns = [],
  rows = [],
  loading,
  emptyText = "No results",
  className = "smart-search",
}) {
  return (
    <div className={className} style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => onQueryChange && onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onSearch) onSearch(); }}
          placeholder="Search..."
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, minWidth: 240, background: "#fff", color: "#000" }}
        />
        <button type="button" onClick={onSearch} style={{ padding: "8px 12px" }}>Search</button>
        {actions}
      </div>

      {filters && (
        <FilterBar filters={filters} onChange={onFilterChange} />
      )}

      {loading ? (
        <div style={{ padding: 10 }}>Loading...</div>
      ) : (
        <DataTable columns={columns} rows={rows} emptyText={emptyText} />
      )}
    </div>
  );
}

