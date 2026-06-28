import React from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function ShowcaseSection({ id, title, description, route, components = [], children }) {
  return (
    <section id={id} className="showcase-section">
      <div className="showcase-section-head">
        <div>
          <span className="showcase-route">{route}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge>Ready</StatusBadge>
      </div>
      <div className="showcase-section-body">{children}</div>
      <div className="showcase-component-list">
        {components.map((item) => <span key={item}>{item}</span>)}
      </div>
      <a className="showcase-open-btn" href={route}>Open Full Page</a>
    </section>
  );
}
