import { api } from "./client.js";

export const PaymentIntentAPI = {
  create: ({ declaration_id, amount_etb, provider, metadata }) => api.post("/payments/intent", { declaration_id, amount_etb, provider, metadata }),
  get: (id) => api.get(`/payments/intent/${id}`),
  mockSucceed: (id, payload) => api.post(`/payments/mock/${id}/succeed`, payload || {}),
};

