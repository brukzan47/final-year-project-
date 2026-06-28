import { api } from "./client.js";

export const SystemHealthAPI = {
  get: () => api.get("/system-health"),
  summary: () => api.get("/system-health/summary"),
};
