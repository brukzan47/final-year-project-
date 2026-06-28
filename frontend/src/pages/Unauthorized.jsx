import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Unauthorized() {
  const { t } = useLanguage();
  return (
    <div>
      <h2>{t("unauthorized")}</h2>
      <p>{t("noAccessPage")}</p>
    </div>
  );
}
