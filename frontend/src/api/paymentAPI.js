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

export const PaymentsAPI = {
  list: () => api.get("/payments"),
  summary: () => api.get("/payments/summary"),
  auditLogs: () => api.get("/payments/audit-logs"),
  ledger: () => api.get("/payments/ledger"),
  accountingLedger: () => api.get("/payments/ledger/accounting"),
  getStatus: (id) => api.get(`/payments/${id}`),
  create: (payload) => api.post("/payments", payload),
  initiate: (id, provider) => api.post(`/payments/${id}/initiate`, { provider }),
  reverify: (id, payload) => api.post(`/payments/${id}/reverify`, payload || {}),
  approve: (id) => api.put(`/payments/${id}/approve`),
  verify: (id) => api.put(`/payments/${id}/verify`),
  reject: (id, payload) => api.put(`/payments/${id}/reject`, payload || {}),
  downloadReceipt: async (id) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/payments/${id}/receipt`, {
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
    return res.blob();
  },
};

export const RefundsAPI = {
  list: () => api.get("/refunds"),
  create: (payload) => api.post("/refunds", payload),
  updateStatus: (id, payload) => api.patch(`/refunds/${id}/status`, payload),
};
