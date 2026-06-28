import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { ROLE_GROUPS, hasRoleAccess } from "../utils/roleAccess.js";

// Mobile-first quick nav. Picks a concise set of links per role.
const baseTabs = [
  { to: "/home", label: "Home", roles: ROLE_GROUPS.all },
  { to: "/declarations-admin", label: "Declare", roles: ROLE_GROUPS.declarations },
  { to: "/inspections", label: "Inspections", roles: ROLE_GROUPS.inspections },
  { to: "/clearance", label: "Clearance", roles: ROLE_GROUPS.clearance },
  { to: "/reports", label: "Reports", roles: ROLE_GROUPS.reports },
];

const importerTabs = [
  { to: "/home", label: "Home", roles: ["Importer"] },
  { to: "/my-tracking", label: "My Tracking", roles: ["Importer"] },
  { to: "/shipments", label: "Shipments", roles: ["Importer"] },
];

const adminTabs = [
  { to: "/home", label: "Home", roles: ROLE_GROUPS.admin },
  { to: "/smart-analytics", label: "Smart Analytics", roles: ROLE_GROUPS.admin },
  { to: "/data-health", label: "Data Health", roles: ROLE_GROUPS.admin },
  { to: "/reports", label: "Reports", roles: ROLE_GROUPS.admin },
];

const financeTabs = [
  { to: "/finance", label: "Finance", roles: ["Finance Officer"] },
  { to: "/home", label: "Home", roles: ["Finance Officer"] },
];

export default function MobileTabs() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = useMemo(() => {
    const pool = role === "Importer" ? importerTabs : role === "Admin" || role === "Super Admin" ? adminTabs : role === "Finance Officer" ? financeTabs : baseTabs;
    return pool.filter((tab) => hasRoleAccess(role, tab.roles)).slice(0, 4);
  }, [role]);

  if (!tabs.length) return null;

  return (
    <nav className="mobile-tabs" aria-label="Mobile quick navigation">
      {tabs.map((tab) => {
        const active = location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
        return (
          <button
            key={tab.to}
            className={`mobile-tab ${active ? "is-active" : ""}`}
            onClick={() => navigate(tab.to)}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-tab-label">{translateTabLabel(tab.label, t)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function translateTabLabel(label, t) {
  if (label === "Home") return t("home");
  if (label === "Declare") return t("declare");
  if (label === "Shipments") return t("shipmentDesk");
  if (label === "Reports") return t("reports");
  if (label === "Inspections") return t("inspectionDesk");
  if (label === "Clearance") return t("clearanceControl");
  if (label === "Payments") return t("paymentBoard");
  if (label === "Finance") return t("financeWorkspace");
  if (label === "Smart Analytics") return t("smartAnalytics");
  if (label === "Profile") return t("profile");
  if (label === "My Tracking") return t("myTracking");
  if (label === "Data Health") return t("dataHealth");
  return label;
}
