import { api } from "./client.js";

export const ShipmentsAPI = {
  list: () => api.get("/shipments"),
  create: (payload) => api.post("/shipments", payload),
  update: (id, payload) => api.patch(`/shipments/${encodeURIComponent(id)}`, payload),
};
