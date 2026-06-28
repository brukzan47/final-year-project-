import React from "react";

export default function ShowcaseHeader({ dark, onToggleDark }) {
  return (
    <header className="showcase-hero">
      <div>
        <span className="showcase-badge">Production UI Preview</span>
        <h1>Customs Trade Portal UI Showcase</h1>
        <p>Complete frontend interface preview for all modules in one premium review workspace.</p>
      </div>
      <div className="showcase-hero-actions">
        <a href="/home">View Dashboard</a>
        <button type="button">Export UI Report</button>
        <button type="button" onClick={onToggleDark}>{dark ? "Light Mode" : "Toggle Dark Mode"}</button>
      </div>
    </header>
  );
}
