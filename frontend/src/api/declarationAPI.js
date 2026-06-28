import { api } from "./client.js";

export const DeclarationsAPI = {
  list: () => api.get("/declarations"),
  create: (payload) => api.post("/declarations", payload),
  approve: (id) => api.post(`/declarations/${encodeURIComponent(id)}/approve`),
  reject: (id, reason) => api.post(`/declarations/${encodeURIComponent(id)}/reject`, { reason }),
  find: (no) => api.get(`/declarations/find?no=${encodeURIComponent(no)}`),
  regenerateNumber: (id) => api.post(`/declarations/${encodeURIComponent(id)}/regenerate-number`),
};
