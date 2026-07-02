import { useEffect } from "react";

// Adds data-labels to table cells based on the header text and enables stacking on mobile.
export default function ResponsiveTables() {
  useEffect(() => {
    let pending = false;
    let idleId = null;
    let timeoutId = null;
    let queuedTables = new Set();
    let annotateAll = false;

    const isSmallScreen = () => {
      try {
        return window.matchMedia("(max-width: 760px)").matches;
      } catch {
        return true;
      }
    };

    const collectTables = (node) => {
      if (!node || node.nodeType !== 1) return [];
      if (node.matches?.("table.smart-table")) return [node];
      const tables = Array.from(node.querySelectorAll?.("table.smart-table") || []);
      const parentTable = node.closest?.("table.smart-table");
      if (parentTable) tables.push(parentTable);
      return tables;
    };

    const annotateTable = (tbl) => {
      const headers = Array.from(tbl.querySelectorAll("thead th")).map((th) =>
        (th.textContent || "").trim()
      );
      if (!headers.length) return;
      tbl.classList.add("smart-table--stack");
      const rows = Array.from(tbl.querySelectorAll("tbody tr"));
      rows.forEach((tr) => {
        const cells = Array.from(tr.cells || []);
        cells.forEach((td, idx) => {
          if (!td.getAttribute("data-label") && headers[idx]) {
            td.setAttribute("data-label", headers[idx]);
          }
        });
        ensureRowToggle(tr, cells.length);
      });
    };

    const annotate = () => {
      pending = false;
      idleId = null;
      timeoutId = null;
      if (!isSmallScreen()) {
        queuedTables.clear();
        annotateAll = false;
        return;
      }
      try {
        const tables = annotateAll
          ? Array.from(document.querySelectorAll("table.smart-table"))
          : Array.from(queuedTables);
        queuedTables.clear();
        annotateAll = false;
        tables.forEach(annotateTable);
      } catch {}
    };

    const scheduleAnnotate = (tables = []) => {
      if (!isSmallScreen()) return;
      tables.forEach((table) => queuedTables.add(table));
      if (pending) return;
      pending = true;
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(annotate, { timeout: 1000 });
      } else {
        timeoutId = window.setTimeout(annotate, 180);
      }
    };

    const scheduleAll = () => {
      annotateAll = true;
      scheduleAnnotate();
    };

    const onResize = () => {
      if (isSmallScreen()) scheduleAll();
    };

    scheduleAll();
    window.addEventListener("resize", onResize);
    const observer = new MutationObserver((mutations) => {
      const tables = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes?.forEach((node) => {
          tables.push(...collectTables(node));
        });
      });
      if (tables.length) scheduleAnnotate(tables);
    });
    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch {}
    return () => {
      window.removeEventListener("resize", onResize);
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      queuedTables.clear();
      try { observer.disconnect(); } catch {}
    };
  }, []);

  return null;
}

function ensureRowToggle(tr, cellCount) {
  try {
    if (!tr || tr.getAttribute("data-row-toggle-ready") === "1") return;
    if (cellCount <= 2) return;
    const firstCell = tr.cells?.[0];
    if (!firstCell) return;

    tr.classList.add("smart-row-collapsed");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "smart-row-toggle";
    btn.textContent = "Show";
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", () => {
      const expanded = tr.classList.toggle("smart-row-expanded");
      tr.classList.toggle("smart-row-collapsed", !expanded);
      btn.textContent = expanded ? "Hide" : "Show";
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });

    firstCell.appendChild(btn);
    tr.setAttribute("data-row-toggle-ready", "1");
  } catch {}
}
