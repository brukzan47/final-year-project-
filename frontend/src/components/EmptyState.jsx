import React from "react";

export default function EmptyState({ title = "Nothing here yet", description = "", actionLabel = null, onAction = null }) {
  return (
    <div className="card" style={{ padding: 18, textAlign: 'center' }}>
      <h3 style={{ marginTop: 6, marginBottom: 6 }}>{title}</h3>
      {description && <div style={{ color: '#6b7280', marginBottom: 12 }}>{description}</div>}
      {actionLabel && onAction && (
        <button onClick={onAction} style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 0, borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

