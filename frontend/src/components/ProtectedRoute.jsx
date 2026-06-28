import React from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRoleAccess } from "../utils/roleAccess.js";

function MissingRoleView() {
  const { logout } = useAuth();
  return (
    <div style={{ padding: 24 }}>
      <h3>Role Missing</h3>
      <p style={{ marginTop: 8 }}>
        Your account is authenticated but has no assigned role. Contact system administrator.
      </p>
      <button type="button" onClick={logout} style={{ marginTop: 12 }}>
        Sign out
      </button>
    </div>
  );
}

export default function ProtectedRoute({ children, roles, fallback = null, unauthorized = null }) {
  const { token, role } = useAuth();

  if (!token) return fallback;
  if (!String(role || "").trim()) return <MissingRoleView />;

  if (roles && roles.length > 0 && !hasRoleAccess(role, roles)) {
    return unauthorized ?? fallback;
  }
  return children;
}
