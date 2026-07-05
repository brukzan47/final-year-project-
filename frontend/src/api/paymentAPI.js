import { api } from "./client.js";

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
  downloadReceipt: (id) => api.download(`/payments/${id}/receipt`),
};

export const RefundsAPI = {
  list: () => api.get("/refunds"),
  create: (payload) => api.post("/refunds", payload),
  updateStatus: (id, payload) => api.patch(`/refunds/${id}/status`, payload),
};
