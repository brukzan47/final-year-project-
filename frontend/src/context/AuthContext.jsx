import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginAPI, getMe } from "../api/authAPI.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState(null);
  const [email, setEmail] = useState(null);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [importerId, setImporterId] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
      if (raw) {
        const { token, role, name, email, preferred_language } = JSON.parse(raw);
        setToken(token || null);
        setRole(role || null);
        setName(name || null);
        setEmail(email || null);
        setPreferredLanguage(preferred_language === "am" ? "am" : "en");
      }
      const rawMe = localStorage.getItem("me") || sessionStorage.getItem("me");
      if (rawMe) {
        const me = JSON.parse(rawMe);
        setImporterId(me?.importer_id || null);
        if (me?.preferred_language) setPreferredLanguage(me.preferred_language === "am" ? "am" : "en");
      }
    } catch {}
  }, []);

  const login = async (email, password, remember = true) => {
    const hasRole = (v) => !!String(v || "").trim();
    const res = await loginAPI(email, password);
    setToken(res.token);
    if (!hasRole(res.role)) { throw new Error("Account has no role assigned. Contact system administrator."); }
    setRole(res.role);
    setName(res.name);
    setPreferredLanguage(res.preferred_language === "am" ? "am" : "en");
    const storage = remember ? localStorage : sessionStorage;
    const alternateStorage = remember ? sessionStorage : localStorage;
    alternateStorage.removeItem("auth");
    alternateStorage.removeItem("me");
    storage.setItem("auth", JSON.stringify(res));
    try {
      const me = await getMe();
      storage.setItem("me", JSON.stringify(me));
      setImporterId(me?.importer_id || null);
      if (me?.preferred_language) setPreferredLanguage(me.preferred_language === "am" ? "am" : "en");
    } catch {}
    return res;
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setName(null);
    setPreferredLanguage("en");
    setImporterId(null);
    localStorage.removeItem("auth");
    localStorage.removeItem("me");
    sessionStorage.removeItem("auth");
    sessionStorage.removeItem("me");
  };

  const value = useMemo(() => ({ token, role, name, email, preferredLanguage, importerId, login, logout }), [token, role, name, email, preferredLanguage, importerId]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


