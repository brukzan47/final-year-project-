import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function FabAssistant() {
  const nav = useNavigate();
  const { role } = useAuth();

  if (role === "Admin") return null;

  return (
    <button
      onClick={() => nav('/assistant')}
      title="Ask Assistant"
      style={{ position: 'fixed', right: 18, bottom: 18, width: 54, height: 54, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 22 }}
    >
      ?
    </button>
  );
}
