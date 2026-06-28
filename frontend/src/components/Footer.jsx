import React from "react";
import pkg from "../../package.json";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="footer-shell">
      <div className="footer-col footer-col-brand">
        <span
          className="footer-badge"
          aria-hidden
        >
          EC
        </span>
        <div>
          <div className="footer-brand">Ethiopian Import Management System</div>
          <div className="footer-meta">Version 2.0 | Secure Government Digital Trade Portal</div>
          <div className="footer-meta">Ethiopian Customs Commission</div>
        </div>
      </div>

      <div className="footer-col footer-col-office">
        <div className="footer-head">{t("headOffice")}</div>
        <div className="footer-text">Ministry Compound, Addis Ababa, Ethiopia</div>
        <div className="footer-meta footer-meta-gap">Phone: +251-11-123-4567 | Email: support@eicustoms.gov.et</div>
        <div className="footer-meta">{t("officeHours")}: Mon-Fri 08:30 - 17:00</div>
      </div>

      <div className="footer-col footer-col-legal">
        <div className="footer-links">
          <a href="/privacy">{t("privacy")}</a>
          <a href="/terms">{t("terms")}</a>
          <a href="/reports">Help Center</a>
          <a href="/contact">Contact Support</a>
        </div>
      </div>
      <div className="footer-copy-wide">
        (c) 2026 Ethiopian Customs Commission. {t("appLegal")} v{pkg?.version || "2.0"}
      </div>
    </footer>
  );
}
