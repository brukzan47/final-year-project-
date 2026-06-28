import React from "react";

export default function MiniChartPreview({ type = "bars", values = [42, 55, 38, 72, 64, 80], title }) {
  return (
    <div className={`showcase-chart showcase-chart--${type}`}>
      {title && <div className="showcase-chart-title">{title}</div>}
      {type === "donut" ? (
        <span className="showcase-donut" />
      ) : type === "line" || type === "area" ? (
        <svg viewBox="0 0 280 120" aria-hidden="true">
          <path className="showcase-chart-grid" d="M10 24H270M10 60H270M10 96H270" />
          {type === "area" && <path className="showcase-chart-area" d="M12 92 C54 50 78 70 112 45 C150 18 174 70 214 38 C244 14 258 34 270 24 L270 116 L12 116Z" />}
          <path className="showcase-chart-line" d="M12 92 C54 50 78 70 112 45 C150 18 174 70 214 38 C244 14 258 34 270 24" />
        </svg>
      ) : (
        <div className="showcase-bars" aria-hidden="true">
          {values.map((value, index) => <span key={index} style={{ height: `${value}%` }} />)}
        </div>
      )}
    </div>
  );
}
