import { api } from "./client.js";

export const TradeAPI = {
  requestPermit: (payload) => api.post(`/integrations/trade/permits`, payload),
  status: (declarationId) => api.get(`/integrations/trade/permits/${encodeURIComponent(declarationId)}`),
};

