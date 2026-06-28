import { api } from "./client.js";

export const RiskAPI = {
  queues: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    );
    return api.get(`/risk/queues${q.toString() ? `?${q.toString()}` : ""}`);
  },
};
