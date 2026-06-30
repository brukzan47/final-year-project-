import { useEffect } from "react";

// Adds data-labels to table cells based on the header text and enables stacking on mobile.
export default function ResponsiveTables() {
  useEffect(() => {
    let pending = false;
    let idleId = null;
    let timeoutId = null;

    const annotate = () => {
      pending = false;
      idleId = null;
      timeoutId = null;
      try {
        const tables = Array.from(document.querySelectorAll("table.smart-table"));
        tables.forEach((tbl) => {
          const headers = Array.from(tbl.querySelectorAll("thead th")).map((th) =>
            (th.textContent || "").trim()
          );
          if (!headers.length) return;
          // Enable stack styling; CSS is media-scoped to small screens
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
        });
      } catch {}
    };

    const scheduleAnnotate = () => {
      if (pending) return;
      pending = true;
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(annotate, { timeout: 600 });
      } else {
        timeoutId = window.setTimeout(annotate, 120);
      }
    };

    scheduleAnnotate();
    window.addEventListener("resize", scheduleAnnotate);
    const observer = new MutationObserver(scheduleAnnotate);
    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch {}
    return () => {
      window.removeEventListener("resize", scheduleAnnotate);
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
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
