import { api } from "./client.js";

export const ClearancesAPI = {
  list: () => api.get("/clearances"),
  readiness: () => api.get("/clearances/readiness"),
  getById: (id) => api.get(`/clearances/${encodeURIComponent(id)}`),
  create: (payload) => api.post("/clearances", payload),
  downloadReleaseNote: async (clearanceId) => {
    const blob = await api.download(`/clearances/${encodeURIComponent(clearanceId)}/release-note`);
    return { blob, contentType: blob.type || "application/pdf" };
  },
};
