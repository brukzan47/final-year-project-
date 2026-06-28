import { api } from "./client.js";

export const UsersAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== ""));
    return api.get(`/users${q.toString() ? `?${q.toString()}` : ""}`);
  },
  roleAudit: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== ""));
    return api.get(`/users/role-audit${q.toString() ? `?${q.toString()}` : ""}`);
  },
  getById: (id) => api.get(`/users/${encodeURIComponent(id)}`),
  getImporterRecord: (id) => api.get(`/users/${encodeURIComponent(id)}/importer-record`),
  create: (payload) => api.post("/users", payload),
  updateRole: (id, role, note = "") => api.patch(`/users/${encodeURIComponent(id)}/role`, { role, note }),
  updateStatus: (id, status) => api.patch(`/users/${encodeURIComponent(id)}/status`, { status }),
  resetPassword: (id, new_password) => api.patch(`/users/${encodeURIComponent(id)}/reset-password`, { new_password }),
};
