import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { navItems } from "../routes/navItems.js";
import { hasRoleAccess } from "../utils/roleAccess.js";
import { AppIcon } from "../components/IconStore.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import { DeclarationsAPI } from "../api/declarationAPI.js";
import { ShipmentsAPI } from "../api/shipmentAPI.js";
import "../styles/eims-enterprise.css";

const quickStats = [
  { key: "declarations", label: "Declarations", tone: "green" },
  { key: "pending", label: "Pending", tone: "amber" },
  { key: "shipments", label: "Shipments", tone: "blue" },
  { key: "inTransit", label: "In transit", tone: "purple" },
];

const primaryByRole = {
  Importer: ["/my-tracking", "/shipments", "/declarations", "/payments"],
  "Finance Officer": ["/finance", "/payments", "/reports"],
  "Clearance Officer": ["/clearance", "/search", "/reports"],
  "Port Officer": ["/shipments", "/devices", "/locations"],
  "Risk Analyst": ["/smart-analytics", "/search", "/reports"],
  Auditor: ["/smart-analytics", "/reports", "/search"],
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function statusOf(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("clear") || text.includes("approve") || text.includes("paid")) return "portal-badge";
  if (text.includes("reject") || text.includes("fail") || text.includes("risk")) return "portal-badge portal-badge--amber";
  return "portal-badge portal-badge--blue";
}

export default function Home() {
  const navigate = useNavigate();
  const { role, name, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [query, setQuery] = useState("");
  const [declarations, setDeclarations] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const allowedItems = useMemo(
    () => navItems.filter((item) => hasRoleAccess(role, item.roles)),
    [role]
  );

  const roleItems = useMemo(() => {
    const preferred = primaryByRole[role] || ["/declarations-admin", "/smart-analytics", "/shipments", "/reports"];
    const byPath = new Map(allowedItems.map((item) => [item.to, item]));
    const ordered = preferred.map((path) => byPath.get(path)).filter(Boolean);
    const rest = allowedItems.filter((item) => !preferred.includes(item.to));
    return [...ordered, ...rest].slice(0, 8);
  }, [allowedItems, role]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allowedItems
      .map((item) => ({ ...item, label: t(item.labelKey) }))
      .filter((item) => `${item.label} ${item.to}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allowedItems, query, t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([DeclarationsAPI.list(), ShipmentsAPI.list()])
      .then(([declRes, shipRes]) => {
        if (!active) return;
        setDeclarations(Array.isArray(declRes.value) ? declRes.value : []);
        setShipments(Array.isArray(shipRes.value) ? shipRes.value : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const pending = declarations.filter((item) => String(item.status || "").toLowerCase().includes("pending")).length;
    const inTransit = shipments.filter((item) => String(item.status || "").toLowerCase().includes("transit")).length;
    return {
      declarations: declarations.length,
      pending,
      shipments: shipments.length,
      inTransit,
    };
  }, [declarations, shipments]);

  const recentDeclarations = declarations.slice(0, 5);
  const recentShipments = shipments.slice(0, 5);
  const today = new Date();

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <button type="button" className="portal-brand" onClick={() => navigate("/home")}>
          <span className="portal-brand__mark">ET</span>
          <span>
            <strong>Ethiopian Import</strong>
            <span>Management System</span>
          </span>
        </button>

        <div className="portal-nav-group">
          <div className="portal-nav-heading">{t("modules")}</div>
          {roleItems.map((item) => (
            <button
              key={item.to}
              type="button"
              className={item.to === "/home" ? "portal-nav portal-nav--active" : "portal-nav"}
              onClick={() => navigate(item.to)}
            >
              <i><AppIcon name={item.labelKey} size={17} /></i>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className="portal-support">
          <strong>{role || t("unknown")}</strong>
          <span>{name || "Authorized user"}</span>
        </div>
      </aside>

      <section className="portal-main">
        <header className="portal-topbar">
          <div className="portal-page-title">
            <strong>{t("home")}</strong>
            <span>{t("homeSubtitle")}</span>
          </div>

          <div className="portal-search" role="search">
            <AppIcon name="search" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) navigate(searchResults[0].to);
                if (event.key === "Escape") setQuery("");
              }}
              placeholder={t("searchPagesHint")}
              aria-label={t("searchPagesHint")}
            />
            <kbd>Ctrl K</kbd>
            {!!query.trim() && (
              <div className="portal-search__results">
                {searchResults.length ? searchResults.map((item) => (
                  <button key={item.to} type="button" onClick={() => navigate(item.to)}>
                    <AppIcon name={item.labelKey} size={15} />
                    <span>{item.label}</span>
                    <small>{item.to}</small>
                  </button>
                )) : (
                  <div className="portal-search__empty">{t("commandNoMatches")}</div>
                )}
              </div>
            )}
          </div>

          <div className="portal-actions">
            <button type="button" className="portal-language" onClick={() => setLang(lang === "en" ? "am" : "en")}>
              <AppIcon name="language" size={15} />
              <b>{lang === "en" ? "EN" : "AM"}</b>
            </button>
            <NotificationBell />
            <button type="button" className="portal-icon" onClick={() => navigate("/profile")} aria-label={t("profile")} title={t("profile")}>
              <AppIcon name="profile" size={17} />
            </button>
            <button type="button" className="portal-icon" onClick={logout} aria-label={t("logout")} title={t("logout")}>
              <AppIcon name="logout" size={17} />
            </button>
          </div>
        </header>

        <section className="portal-welcome">
          <div>
            <span>{getGreeting()}, {name || "user"}</span>
            <h1>{t("customsOperationsPortal")}</h1>
            <div className="portal-welcome__date">
              <AppIcon name="home" size={18} />
              <strong>{today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</strong>
              <small>{role || t("roleWorkspace")}</small>
            </div>
          </div>
          <div className="portal-welcome__buttons">
            <button type="button" onClick={() => navigate("/declarations")}>
              {t("declarationDesk")}
            </button>
            <button type="button" onClick={() => navigate(roleItems[0]?.to || "/search")}>
              Open workspace
            </button>
            <button type="button" onClick={() => navigate("/reports")}>
              {t("reports")}
            </button>
          </div>
        </section>

        <section className="portal-kpis">
          {quickStats.map((item) => (
            <article className="portal-kpi" key={item.key}>
              <span className={`portal-kpi__icon ${item.tone}`}>
                <AppIcon name={item.key === "shipments" || item.key === "inTransit" ? "shipmentDesk" : "declarationDesk"} size={18} />
              </span>
              <small>{item.label}</small>
              <strong>{loading ? "..." : stats[item.key]}</strong>
              <em>Live workspace <span>{role || "All roles"}</span></em>
            </article>
          ))}
        </section>

        <section className="portal-grid">
          <article className="portal-card">
            <div className="portal-card__head">
              <h2>{t("roleWorkspace")}</h2>
              <button type="button" onClick={() => navigate("/search")}>{t("search")}</button>
            </div>
            <div className="portal-summary-row">
              {roleItems.slice(0, 4).map((item) => (
                <button key={item.to} type="button" onClick={() => navigate(item.to)}>
                  <span>{t(item.labelKey)}</span>
                  <strong>{item.to}</strong>
                </button>
              ))}
            </div>
          </article>

          <article className="portal-card">
            <div className="portal-card__head">
              <h2>{t("recentDeclarations")}</h2>
              <button type="button" onClick={() => navigate("/declarations-admin")}>{t("reload")}</button>
            </div>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{t("declaration")}</th>
                  <th>{t("importer")}</th>
                  <th>{t("status") || "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {recentDeclarations.length ? recentDeclarations.map((item, index) => (
                  <tr key={item.id || item.declaration_no || index}>
                    <td>{item.declaration_no || item.id || "-"}</td>
                    <td>{item.importer_name || item.importer || "-"}</td>
                    <td><span className={statusOf(item.status)}>{item.status || t("pending")}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="3">{loading ? t("loading") : t("noRecentDeclarations")}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </section>

        <section className="portal-bottom">
          <article className="portal-card">
            <div className="portal-card__head">
              <h2>{t("recentShipments")}</h2>
              <button type="button" onClick={() => navigate("/shipments")}>{t("trackingCenter")}</button>
            </div>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentShipments.length ? recentShipments.map((item, index) => (
                  <tr key={item.id || item.tracking_no || index}>
                    <td>{item.tracking_no || item.container_no || item.id || "-"}</td>
                    <td>{[item.origin, item.destination].filter(Boolean).join(" -> ") || "-"}</td>
                    <td><span className={statusOf(item.status)}>{item.status || t("inTransit")}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="3">{loading ? t("loading") : t("noShipmentsYet")}</td></tr>
                )}
              </tbody>
            </table>
          </article>

          <article className="portal-promo">
            <h2>{t("smartAnalytics")}</h2>
            <p>{t("smartAnalyticsDesc")}</p>
            <button type="button" onClick={() => navigate("/smart-analytics")}>{t("launchPreview")}</button>
            <div className="portal-promo__art" aria-hidden="true">
              <span />
              <i />
              <b />
              <em />
            </div>
          </article>
        </section>

        <footer className="portal-footer">
          <span>{t("appName").replace("\n", " ")}</span>
          <i>{t("appLegal")}</i>
        </footer>
      </section>
    </div>
  );
}
