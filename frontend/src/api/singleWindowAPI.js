import { api } from "./client.js";

export const SingleWindowAPI = {
  get: (declarationId) => api.get(`/single-window/${encodeURIComponent(declarationId)}`),
  status: () => api.get(`/single-window/status`),
};
