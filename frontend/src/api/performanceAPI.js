import { api } from "./client.js";

export const PerformanceAPI = {
  list: () => api.get("/performance"),
  create: (payload) => api.post("/performance", payload),
};
