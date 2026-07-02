import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { navItems } from "../routes/navItems.js";
import { ROLE_GROUPS, hasRoleAccess } from "../utils/roleAccess.js";

export default function CommandPalette() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const toast = useToast();

  const toggleDensity = () => {
    try {
      const cur = document.documentElement.getAttribute("data-density") || "regular";
      const next = cur === "compact" ? "regular" : "compact";
      document.documentElement.setAttribute("data-density", next);
      localStorage.setItem("density", next);
    } catch {}
  };

  const routeItems = useMemo(
    () =>
      navItems
        .filter((i) => hasRoleAccess(role, i.roles))
        .map((i) => ({ type: "route", label: t(i.labelKey), to: i.to })),
    [role, t]
  );

  const actionItems = useMemo(() => {
    const byRole = (allowed) => hasRoleAccess(role, allowed);
    const all = [
      { type: "action", label: `${t("declarationDesk")}`, run: () => navigate("/declarations"), roles: ROLE_GROUPS.declarationEntry },
      { type: "action", label: `${t("declarationAdmin")}`, run: () => navigate("/declarations-admin"), roles: ROLE_GROUPS.declarationReview },
      { type: "action", label: `${t("shipmentDesk")}`, run: () => navigate("/shipments"), roles: ROLE_GROUPS.tracking },
      { type: "action", label: `${t("reports")}`, run: () => navigate("/reports"), roles: ROLE_GROUPS.reports },
      { type: "action", label: `${t("notificationsAdmin")}`, run: () => navigate("/notifications-admin"), roles: ROLE_GROUPS.notifications },
      { type: "action", label: `${t("financeWorkspace")}`, run: () => navigate("/finance"), roles: ROLE_GROUPS.finance },
      { type: "action", label: `${t("paymentBoard")}`, run: () => navigate("/payments"), roles: ROLE_GROUPS.payments },
      { type: "action", label: `${t("users")}`, run: () => navigate("/users"), roles: ROLE_GROUPS.users },
      {
        type: "action",
        label: "Toggle Density",
        run: () => {
          toggleDensity();
          try {
            if ((localStorage.getItem("action_toasts") ?? "true") === "true") toast?.success?.("Density toggled");
          } catch {}
        },
      },
    ];
    return all.filter((a) => byRole(a.roles));
  }, [navigate, role, t, toast]);

  const items = useMemo(() => [...actionItems, ...routeItems], [actionItems, routeItems]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s) || (i.to || "").toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    const onKey = (e) => {
      try {
        const metaK = (e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K");
        if (metaK) {
          e.preventDefault();
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        if (!open) return;
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setIdx((i) => Math.max(i - 1, 0));
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const target = filtered[idx];
          if (target) {
            setOpen(false);
            if (target.type === "action") {
              target.run && target.run();
            } else {
              navigate(target.to);
            }
          }
        }
      } catch {}
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("command-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("command-palette:open", onOpen);
    };
  }, [filtered, idx, navigate, open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div style={styles.backdrop}>
      <div style={styles.sheet} role="dialog" aria-modal="true" aria-label="Command Palette">
        <input
          ref={inputRef}
          placeholder={t("searchPagesHint")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          style={styles.input}
        />
        <div style={styles.list}>
          {filtered.length === 0 && <div style={styles.empty}>{t("commandNoMatches")}</div>}
          {filtered.map((it, i) => (
            <div
              key={`${it.type}-${it.to || it.label}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                setOpen(false);
                if (it.type === "action") {
                  it.run && it.run();
                } else {
                  navigate(it.to);
                }
              }}
              style={{ ...styles.item, ...(i === idx ? styles.active : null) }}
              role="button"
              tabIndex={-1}
            >
              <div>
                <span style={{ marginRight: 8, fontSize: 12, color: "#6b7280" }}>{it.type === "action" ? t("action") : t("page")}</span>
                {it.label}
              </div>
              <div style={styles.path}>{it.to || ""}</div>
            </div>
          ))}
        </div>
        <div style={styles.hint}>{t("commandTip")}</div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, zIndex: 2000 },
  sheet: { width: "100%", maxWidth: 600, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, boxShadow: "var(--shadow-md)", overflow: "hidden" },
  input: { width: "100%", border: 0, borderBottom: "1px solid var(--color-border)", padding: "12px 14px", fontSize: 16, outline: "none", background: "transparent", color: "var(--color-text)" },
  list: { maxHeight: 360, overflow: "auto", display: "grid" },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer" },
  active: { background: "var(--color-row-hover)" },
  path: { fontSize: 12, color: "#6b7280" },
  empty: { padding: "14px", color: "#6b7280" },
  hint: { padding: "8px 12px", fontSize: 12, color: "#6b7280", borderTop: "1px solid var(--color-border)" },
};

