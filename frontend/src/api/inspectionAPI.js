import { api } from "./client.js";

export const InspectionsAPI = {
  list: () => api.get("/inspections"),
  create: (payload) => api.post("/inspections", payload),
};
