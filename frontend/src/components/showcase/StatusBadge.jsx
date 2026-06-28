import React from "react";

export default function StatusBadge({ tone = "success", children = "Ready" }) {
  return <span className={`showcase-status showcase-status--${tone}`}>{children}</span>;
}
