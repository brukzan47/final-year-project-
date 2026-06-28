import { api } from "./client.js";

export const LocationAPI = {
  list: () => api.get("/locations"),
  create: (data) => api.post("/locations", data),
  update: (name, data) => api.patch(`/locations/${encodeURIComponent(name)}`, data),
  remove: (name) => api.del(`/locations/${encodeURIComponent(name)}`),
  importCsv: (csv) => api.post('/locations/import-csv', { csv }),
};
