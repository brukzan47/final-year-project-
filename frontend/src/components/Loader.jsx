import React from "react";
import { LoaderCircle } from "lucide-react";

export default function Loader({ label = "Loading...", fullPage = false }) {
  return (
    <div className={fullPage ? "app-loader app-loader--full" : "app-loader"} role="status" aria-live="polite">
      <LoaderCircle className="app-loader__icon" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
