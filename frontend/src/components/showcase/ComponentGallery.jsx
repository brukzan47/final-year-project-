import React from "react";
import MiniKpiCard from "./MiniKpiCard.jsx";
import MiniTablePreview from "./MiniTablePreview.jsx";
import StatusBadge from "./StatusBadge.jsx";

export default function ComponentGallery() {
  return (
    <section className="showcase-section showcase-gallery" id="components">
      <div className="showcase-section-head">
        <div>
          <span className="showcase-route">components/showcase</span>
          <h2>Component Gallery</h2>
          <p>Reusable UI primitives used across the portal preview.</p>
        </div>
      </div>
      <div className="showcase-gallery-grid">
        <div className="showcase-preview-card">
          <h4>Buttons</h4>
          <div className="showcase-button-row"><button>Primary</button><button className="secondary">Secondary</button><button className="ghost">Ghost</button></div>
        </div>
        <div className="showcase-preview-card">
          <h4>Inputs</h4>
          <input className="showcase-input" placeholder="Search declaration" />
          <select className="showcase-input"><option>Monthly</option><option>Quarterly</option></select>
        </div>
        <div className="showcase-preview-card">
          <h4>Badges</h4>
          <div className="showcase-button-row"><StatusBadge>Cleared</StatusBadge><StatusBadge tone="warning">Pending</StatusBadge><StatusBadge tone="danger">Rejected</StatusBadge></div>
        </div>
        <MiniKpiCard label="Revenue" value="ETB 2.8M" delta="+15.3%" icon="paymentBoard" tone="blue" />
        <MiniTablePreview columns={["ID", "Status"]} rows={[{ ID: "DECL-1009", Status: "Cleared" }, { ID: "PAY-8821", Status: "Pending", tone: "warning" }]} />
        <div className="showcase-upload-box">Drop customs documents here</div>
        <div className="showcase-timeline"><span /><span /><span /></div>
        <div className="showcase-modal-preview"><strong>Modal Preview</strong><p>Review confirmation dialog layout.</p></div>
      </div>
    </section>
  );
}
