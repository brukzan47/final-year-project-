import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { navItems } from "../routes/navItems.js";
import { hasRoleAccess } from "../utils/roleAccess.js";
import NotificationBell from "./NotificationBell.jsx";
import { AppIcon } from "./IconStore.jsx";
import crestLogo from "../assets/logo-et.png";
import ethiopiaStar from "../assets/ethiopia-star.svg";

export default function Navbar() {
  const barRef = useRef(null);
  const [isSmall, setIsSmall] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { token, role, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();

  useEffect(() => {
    const syncNavHeight = () => {
      try {
        const h = barRef.current?.offsetHeight;
        if (h) document.documentElement.style.setProperty("--nav-h", `${h}px`);
      } catch {}
    };
    const onResize = () => {
      try {
        setIsSmall(window.innerWidth <= 768);
      } catch {}
    };
    syncNavHeight();
    onResize();
    window.addEventListener("resize", syncNavHeight);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", syncNavHeight);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (isSmall) setMenuOpen(false);
    try {
      const h = barRef.current?.offsetHeight;
      if (h) document.documentElement.style.setProperty("--nav-h", `${h}px`);
    } catch {}
  }, [location.pathname, isSmall]);

  useEffect(() => {
    try {
      const h = barRef.current?.offsetHeight;
      if (h) document.documentElement.style.setProperty("--nav-h", `${h}px`);
    } catch {}
  }, [menuOpen, isSmall]);

  const fallbackLogo = "https://customs.erca.gov.et/trade/assets/logo-et-f7d6d53d5bd05b2ec681eae59c0f669e.png";
  const headerPages = useMemo(
    () => navItems.filter((item) => hasRoleAccess(role, item.roles)),
    [role]
  );
  const searchableItems = useMemo(
    () =>
      headerPages.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [headerPages, t]
  );
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableItems
      .filter((item) => `${item.label} ${item.to}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchQuery, searchableItems]);

  const openSearchResult = (to) => {
    setSearchQuery("");
    setMenuOpen(false);
    navigate(to);
  };

  const openProfile = () => {
    setMenuOpen(false);
    navigate("/profile");
  };

  const doLogout = () => {
    setMenuOpen(false);
    logout();
  };

  const profileLabel = name?.trim() || t("profile");

  return (
    <header className="app-header" ref={barRef}>
      <div className="brand-header">
        <div className="brand-header-main" aria-label="Ethiopian Import Management System">
          <img src={ethiopiaStar} alt="" className="brand-header-star" loading="lazy" />
          <div className="brand-header-wordmark">
            <span>Ethiopian Import</span>
            <strong>Management System</strong>
          </div>
        </div>
        <div className="brand-header-right">
          <div className="brand-header-commission">
            <div className="brand-header-title">{t("appName")}</div>
            <div className="brand-header-logo">
              <img
                src={crestLogo}
                alt="Ethiopian Import Management System crest"
                loading="lazy"
                title="Ethiopian Import Management System"
                onError={(e) => {
                  if (e?.target?.src !== fallbackLogo) {
                    e.target.src = fallbackLogo;
                  }
                }}
              />
            </div>
          </div>
          {!isSmall && (
            <div className="topbar-account-actions topbar-account-actions--header">
              {token ? (
                <>
                  <button type="button" className="topbar-btn topbar-btn--compact" onClick={openProfile}>
                    <span aria-hidden="true">
                      <AppIcon name="profile" size={14} />
                    </span>
                    <span>{profileLabel}</span>
                  </button>
                  <button type="button" className="topbar-btn topbar-btn--compact" onClick={doLogout}>
                    <span aria-hidden="true">
                      <AppIcon name="logout" size={14} />
                    </span>
                    <span>{t("logout")}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="topbar-btn topbar-btn--compact"
                  onClick={() => {
                    navigate("/home");
                  }}
                >
                  <span aria-hidden="true">
                    <AppIcon name="profile" size={14} />
                  </span>
                  <span>{t("signIn")}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="topbar">
        <nav
          id="top-menu"
          className="topbar-menu"
          data-open={menuOpen ? "true" : "false"}
          style={{ display: menuOpen ? "flex" : "none" }}
        >
          <div className="topbar-menu__section">
            <div className="topbar-menu__label">Pages</div>
            <div className="topbar-menu__pages">
              {headerPages.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="topbar-menu__action"
                  onClick={() => setMenuOpen(false)}
                >
                  <span aria-hidden="true">
                    <AppIcon name={item.labelKey} size={14} />
                  </span>
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>

        </nav>

        <div className="topbar-search-center">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("menu")}
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls="top-menu"
            title={t("menu")}
            className="topbar-icon topbar-menu-toggle topbar-menu-toggle--inline"
          >
            {menuOpen ? "\u2715" : "\u2630"}
          </button>

          <div className="topbar-search-box" role="search">
            <span aria-hidden="true">
              <AppIcon name="search" size={14} />
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults[0]) openSearchResult(searchResults[0].to);
                if (e.key === "Escape") setSearchQuery("");
              }}
              placeholder="Search pages..."
              aria-label="Search pages"
              autoComplete="off"
            />
          </div>

          {isSmall && (
            <div className="topbar-account-actions topbar-account-actions--mobile">
              {token ? (
                <>
                  <button type="button" className="topbar-btn topbar-btn--compact" onClick={openProfile}>
                    <span aria-hidden="true">
                      <AppIcon name="profile" size={14} />
                    </span>
                    <span>{profileLabel}</span>
                  </button>
                  <button type="button" className="topbar-btn topbar-btn--compact" onClick={doLogout}>
                    <span aria-hidden="true">
                      <AppIcon name="logout" size={14} />
                    </span>
                    <span>{t("logout")}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="topbar-btn topbar-btn--compact"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/home");
                  }}
                >
                  <span aria-hidden="true">
                    <AppIcon name="profile" size={14} />
                  </span>
                  <span>{t("signIn")}</span>
                </button>
              )}
            </div>
          )}
          <NotificationBell />

          {searchQuery.trim() && (
            <div className="topbar-search-results" role="listbox" aria-label="Search results">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => openSearchResult(item.to)}
                    role="option"
                  >
                    <AppIcon name={item.labelKey} size={15} />
                    <span>{item.label}</span>
                    <small>{item.to}</small>
                  </button>
                ))
              ) : (
                <div className="topbar-search-empty">No results found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const navLinkStyle = ({ isActive }) => ({
  color: "inherit",
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  background: isActive ? "rgba(236,253,245,0.22)" : "rgba(236,253,245,0.10)",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  border: "1px solid rgba(236,253,245,0.18)",
});
