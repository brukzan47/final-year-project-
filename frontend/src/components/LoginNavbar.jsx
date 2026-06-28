import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogIn, Menu, User } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import ethiopiaStar from "../assets/ethiopia-star.svg";
import crestLogo from "../assets/logo-et.png";

const publicLinks = [
  { label: "Home", to: "/home" },
  { label: "Importers", to: "/importers" },
  { label: "Services", to: "/single-window" },
  { label: "Customs Guide", to: "/search" },
  { label: "Resources", to: "/reports" },
  { label: "Contact", to: "/support/faq" },
];

export default function LoginNavbar() {
  const navigate = useNavigate();
  const { token, name, role, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navClassName = useMemo(
    () => `login-navbar${scrolled ? " is-scrolled" : ""}`,
    [scrolled]
  );

  return (
    <header className={navClassName}>
      <div className="login-navbar__brand">
        <img className="login-navbar__star" src={ethiopiaStar} alt="" aria-hidden="true" />
        <div className="login-navbar__name">
          <strong>Ethiopian Import</strong>
          <span>Management System</span>
        </div>
        <img className="login-navbar__crest" src={crestLogo} alt="" aria-hidden="true" />
      </div>

      <nav className="login-navbar__center" aria-label="Primary">
        {publicLinks.map((item) => (
          <button
            key={item.label}
            type="button"
            className="login-navbar__link"
            onClick={() => navigate(item.to)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="login-navbar__actions">
        <LanguageSwitcher value={lang} onChange={setLang} />
        <button type="button" className="login-navbar__icon" aria-label="Notifications">
          <Bell size={16} />
        </button>
        {token ? (
          <div className="login-navbar__profile">
            <button
              type="button"
              className="login-navbar__profileBtn"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <User size={15} />
              <span>{name || role || "Profile"}</span>
              <ChevronDown size={14} />
            </button>
            {profileOpen && (
              <div className="login-navbar__menu" role="menu">
                <button type="button" role="menuitem" onClick={() => navigate("/profile")}>
                  {t("profile")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                    navigate("/");
                  }}
                >
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className="login-navbar__login" onClick={() => navigate("/home")}>
            <LogIn size={15} />
            <span>{t("signIn")}</span>
          </button>
        )}
        <button
          type="button"
          className="login-navbar__menuButton"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={18} />
        </button>
      </div>
      {mobileOpen && (
        <div className="login-navbar__mobile" role="navigation" aria-label="Mobile navigation">
          {publicLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              className="login-navbar__mobileLink"
              onClick={() => {
                setMobileOpen(false);
                navigate(item.to);
              }}
            >
              {item.label}
            </button>
          ))}
          {!token ? (
            <button type="button" className="login-navbar__mobileLogin" onClick={() => navigate("/home")}>
              <LogIn size={15} />
              <span>{t("signIn")}</span>
            </button>
          ) : null}
        </div>
      )}
    </header>
  );
}
