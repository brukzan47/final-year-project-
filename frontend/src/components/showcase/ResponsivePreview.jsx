import React from "react";

export default function ResponsivePreview() {
  return (
    <section className="showcase-section" id="responsive">
      <div className="showcase-section-head">
        <div>
          <span className="showcase-route">responsive states</span>
          <h2>Responsive Preview</h2>
          <p>Desktop, tablet, and mobile layout proportions for the portal UI.</p>
        </div>
      </div>
      <div className="showcase-responsive-grid">
        {["Desktop", "Tablet", "Mobile"].map((label) => <div key={label} className={`showcase-device ${label.toLowerCase()}`}><span>{label}</span><i /></div>)}
      </div>
    </section>
  );
}
