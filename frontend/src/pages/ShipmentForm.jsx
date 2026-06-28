import React from "react";
import ShipmentWizard from "./importer/ShipmentWizard.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function ShipmentForm() {
  const { lang } = useLanguage();
  return <div lang={lang}><ShipmentWizard /></div>;
}
