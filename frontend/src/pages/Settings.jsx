import React, { useEffect, useState } from "react";
import FormField from "../components/FormField.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const KEY = "app_settings";

export default function Settings() {
  const { setTheme } = useTheme();
  const toast = useToast();
  const { t } = useLanguage();
  const [f, set] = useState(() => {
    let density = 'regular';
    let action_toasts = true;
    let theme = "light";
    let api_base = (import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api");
    let page_size = 10;
    try { density = localStorage.getItem('density') || 'regular'; } catch {}
    try { action_toasts = (localStorage.getItem('action_toasts') ?? 'true') === 'true'; } catch {}
    try { theme = localStorage.getItem('theme') || "light"; } catch {}
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.api_base) api_base = parsed.api_base;
        if (parsed?.page_size) page_size = parsed.page_size;
      }
    } catch {}
    return { api_base, theme, page_size, density, action_toasts };
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) || {};
        if (!parsed.density) {
          try { parsed.density = localStorage.getItem('density') || 'regular'; } catch {}
        }
        if (!parsed.theme) {
          try { parsed.theme = localStorage.getItem('theme') || 'light'; } catch {}
        }
        if (!parsed.api_base) {
          parsed.api_base = import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api";
        }
        if (!parsed.page_size) parsed.page_size = 10;
        if (typeof parsed.action_toasts === 'undefined') {
          try { parsed.action_toasts = (localStorage.getItem('action_toasts') ?? 'true') === 'true'; } catch { parsed.action_toasts = true; }
        }
        set(parsed);
      }
    } catch {}
  }, []);
  const on = (e) => set({ ...f, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    localStorage.setItem(KEY, JSON.stringify(f));
    try {
      localStorage.setItem('density', f.density || 'regular');
      document.documentElement.setAttribute('data-density', f.density || 'regular');
      localStorage.setItem('theme', f.theme || 'light');
      document.documentElement.setAttribute('data-theme', f.theme || 'light');
      setTheme(f.theme || 'light');
      localStorage.setItem('action_toasts', f.action_toasts ? 'true' : 'false');
      localStorage.setItem('page_size', String(f.page_size || 10));
    } catch {}
    toast?.success?.(t("settingsSaved"));
  };

  return (
    <div>
      <h2>{t("settings")}</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 700 }}>
        <FormField label={t("apiBase")} name="api_base" value={f.api_base} onChange={on} placeholder="http://localhost:5000/api" />
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{t("theme")}</span>
          <select name="theme" value={f.theme} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}>
            <option value="light">{t("light")}</option>
            <option value="dark">{t("dark")}</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{t("displayPreset")}</span>
          <select value={`${f.theme||'light'}-${f.density||'regular'}`} onChange={(e) => {
            const [theme, density] = e.target.value.split('-');
            set((prev) => ({ ...prev, theme, density }));
          }} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}>
            <option value="light-regular">{t("comfortableLight")}</option>
            <option value="dark-regular">{t("comfortableDark")}</option>
            <option value="light-compact">{t("compactLight")}</option>
            <option value="dark-compact">{t("compactDark")}</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{t("tableDensity")}</span>
          <select name="density" value={f.density || 'regular'} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}>
            <option value="regular">{t("comfortable")}</option>
            <option value="compact">{t("compact")}</option>
          </select>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{t("compactHint")}</div>
        </label>
        <FormField label={t("pageSize")} type="number" name="page_size" value={f.page_size} onChange={on} placeholder="10" />
        <label style={{ display: "flex", gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="action_toasts" checked={!!f.action_toasts} onChange={(e)=> set({ ...f, action_toasts: e.target.checked })} />
          <span>{t("showActionToasts")}</span>
        </label>
        <button type="submit" style={{ width: 140 }}>{t("save")}</button>
      </form>
    </div>
  );
}


