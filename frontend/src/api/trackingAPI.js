import { api } from "./client.js";

export const TrackingAPI = {
  get: (shipmentId) => api.get(`/tracking/${encodeURIComponent(shipmentId)}`),
  update: (shipmentId, payload) => api.post(`/tracking/${encodeURIComponent(shipmentId)}`, payload),
  trail: (shipmentId, limit = 50) => api.get(`/tracking/${encodeURIComponent(shipmentId)}/trail?limit=${encodeURIComponent(limit)}`),
  devices: {
    list: () => api.get(`/tracking/devices`),
    create: (payload) => api.post(`/tracking/devices`, payload),
  },
  demoSimulate: (payload) => api.post(`/tracking/demo/simulate`, payload),
  demoArrive: (payload) => api.post(`/tracking/demo/arrive`, payload),
  locations: () => api.get(`/tracking/locations`),
};
