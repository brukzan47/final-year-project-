import React from "react";

const items = ["Consistent spacing", "Responsive layout", "Accessible colors", "Reusable components", "Clean tables", "Smooth hover effects", "Dark mode support", "Production-ready UI"];

export default function UiChecklist() {
  return (
    <section className="showcase-section showcase-checklist" id="checklist">
      <div className="showcase-section-head">
        <div>
          <span className="showcase-route">quality checklist</span>
          <h2>Final UI Quality Checklist</h2>
          <p>Review standards applied to the frontend showcase page.</p>
        </div>
      </div>
      <div className="showcase-check-grid">
        {items.map((item) => <div key={item}><span aria-hidden="true">✓</span>{item}</div>)}
      </div>
    </section>
  );
}
