import { api } from "./client.js";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api";

function getToken() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

export const ClearancesAPI = {
  list: () => api.get("/clearances"),
  readiness: () => api.get("/clearances/readiness"),
  getById: (id) => api.get(`/clearances/${encodeURIComponent(id)}`),
  create: (payload) => api.post("/clearances", payload),
  downloadReleaseNote: async (clearanceId) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/clearances/${encodeURIComponent(clearanceId)}/release-note`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch {}
      throw new Error(msg);
    }
    return {
      blob: await res.blob(),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  },
};
