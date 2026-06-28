import React from "react";

export default function Modal({ open, title, onClose, closeDisabled = false, children, headerAction = null, variant = "default" }) {
  if (!open) return null;
  const isLogin = variant === "login";
  const isDocument = variant === "document";
  return (
    <div className={`modal-backdrop modal-backdrop--${variant}`} style={{ ...styles.backdrop, ...(isLogin ? styles.loginBackdrop : {}) }}>
      <div className={`modal-shell modal-shell--${variant}`} style={{ ...styles.modal, ...(isLogin ? styles.loginModal : {}), ...(isDocument ? styles.documentModal : {}) }}>
        <div className={`modal-header modal-header--${variant}`} style={{ ...styles.header, ...(isLogin ? styles.loginHeader : {}) }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {headerAction}
            {!closeDisabled && (
              <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
            )}
          </div>
        </div>
        <div className={`modal-body modal-body--${variant}`} style={{ ...styles.body, ...(isLogin ? styles.loginBody : {}) }}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    overflow: "hidden",
    zIndex: 1000,
  },
  loginBackdrop: {
    background: "transparent",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
  },
  modal: {
    width: "min(520px, calc(100vw - 24px))",
    background: "rgba(255, 255, 255, 0.96)",
    backdropFilter: "blur(14px)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    boxShadow: "var(--shadow-md)",
    overflow: "hidden",
    maxHeight: "calc(100vh - 24px)",
    display: "flex",
    flexDirection: "column",
  },
  loginModal: {
    width: "min(360px, calc(100vw - 32px))",
    minHeight: "auto",
    height: "auto",
    maxHeight: "calc(100vh - 32px)",
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.98)",
    border: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-md)",
    overflowY: "auto",
  },
  documentModal: {
    width: "min(1040px, calc(100vw - 24px))",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  loginHeader: {
    display: "none",
  },
  body: {
    padding: 16,
    overflowY: "auto",
  },
  loginBody: {
    padding: 0,
    background: "transparent",
    overflow: "visible",
  },
  closeBtn: {
    fontSize: 20,
    lineHeight: 1,
    background: "#f8fafc",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    minWidth: 32,
    minHeight: 32,
    cursor: "pointer",
  },
};

