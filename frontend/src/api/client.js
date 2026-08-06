const PRODUCTION_API_BASE = "https://ethiopian-import-management-system2026.onrender.com/api";
const DEFAULT_API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  (import.meta?.env?.PROD ? PRODUCTION_API_BASE : "http://localhost:5000/api");
const SETTINGS_KEY = "app_settings";

export function getApiBase() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const fromSettings = String(parsed?.api_base || "").trim();
      if (fromSettings) return fromSettings;
    }
  } catch {}
  return DEFAULT_API_BASE;
}

export function getToken() {
  try {
    const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, data) => request("POST", path, data),
  put: (path, data) => request("PUT", path, data),
  patch: (path, data) => request("PATCH", path, data),
  del: (path) => request("DELETE", path),
  postForm: async (path, formData) => {
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers, // let browser set Content-Type multipart boundary
      body: formData,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const data = await res.json(); if (data?.message) msg = data.message; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },
  download: async (path) => {
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${getApiBase()}${path}`, { headers });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const data = await res.json(); if (data?.message) msg = data.message; } catch {}
      throw new Error(msg);
    }
    return res.blob();
  },
};
