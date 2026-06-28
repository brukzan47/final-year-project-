import React from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function ModulePreviewCard({ title, route, children }) {
  return (
    <article className="showcase-module-card">
      <div className="showcase-module-head">
        <div>
          <h3>{title}</h3>
          <span>{route}</span>
        </div>
        <StatusBadge>Ready</StatusBadge>
      </div>
      {children}
    </article>
  );
}
