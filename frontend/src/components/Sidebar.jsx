import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { navItems } from "../routes/navItems.js";
import { hasRoleAccess } from "../utils/roleAccess.js";

const link = {
  display: "block",
  padding: "6px 8px",
  color: "#fff",
  textDecoration: "none",
  borderRadius: 6,
  fontSize: 13,
};

const active = ({ isActive }) => ({
  ...link,
  background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
});

export default function Sidebar() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const items = useMemo(() => navItems, []);
  const visible = items.filter((i) => hasRoleAccess(role, i.roles));
  return (
    <aside style={styles.aside}>
      <div style={styles.title}>{t("menu")}</div>
      <nav style={{ display: "grid", gap: 6 }}>
        {visible.map(i => (
          <NavLink key={i.to} to={i.to} style={active}>{t(i.labelKey)}</NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles = {
  aside: {
    background: "var(--color-primary)",
    color: "var(--color-primary-contrast)",
    padding: 12,
    minHeight: "100vh",
    width: 220,
  },
  title: { fontWeight: 700, marginBottom: 8 },
};


