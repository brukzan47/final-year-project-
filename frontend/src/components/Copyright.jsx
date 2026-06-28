import React from "react";
import pkg from "../../package.json";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Copyright() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const version = (pkg && pkg.version) || "0.0.0";
  return (
    <div
      style={{
        textAlign: "center",
        color: "#888",
        fontSize: 12,
        padding: "8px 12px",
      }}
    >
      (c) {year} Ethiopian Import Customs. {t("appLegal")} - v{version}
    </div>
  );
}
