import { api } from "./client.js";

export const TransportAPI = {
  link: (payload) => api.post(`/integrations/transport/links`, payload),
  status: (shipmentId) => api.get(`/integrations/transport/links/${encodeURIComponent(shipmentId)}`),
  events: (shipmentId) => api.get(`/integrations/transport/links/${encodeURIComponent(shipmentId)}/events`),
};
