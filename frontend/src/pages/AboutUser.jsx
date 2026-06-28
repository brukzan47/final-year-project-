import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AboutUser() {
  const { t } = useLanguage();
  const { role, name } = useAuth();

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>{t("aboutUser")}</h2>
      <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc", color: "#334155" }}>
        {t("aboutUserText")}
      </div>
      <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <div><strong>{t("fullName")}:</strong> {name || "-"}</div>
        <div><strong>{t("role")}:</strong> {role || "-"}</div>
      </div>
    </div>
  );
}

