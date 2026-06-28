import React from "react";

export default function PreviewCard({ title, children, className = "" }) {
  return (
    <div className={`showcase-preview-card ${className}`}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}
