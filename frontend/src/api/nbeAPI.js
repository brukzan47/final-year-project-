import { api } from "./client.js";

export const NbeAPI = {
  request: (payload) => api.post(`/integrations/nbe/fx/approvals`, payload),
  status: (declarationId) => api.get(`/integrations/nbe/fx/approvals/${encodeURIComponent(declarationId)}`),
};

