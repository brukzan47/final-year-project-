import React from "react";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ value = "en", onChange }) {
  return (
    <div className="language-switcher" aria-label="Language selector">
      <Globe size={14} aria-hidden="true" />
      <button
        type="button"
        className={value === "en" ? "is-active" : ""}
        onClick={() => onChange?.("en")}
        aria-pressed={value === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={value === "am" ? "is-active" : ""}
        onClick={() => onChange?.("am")}
        aria-pressed={value === "am"}
      >
        አማ
      </button>
    </div>
  );
}
