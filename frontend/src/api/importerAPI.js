import { api } from "./client.js";

export const ImportersAPI = {
  list: async () => {
    try {
      return await api.get("/importers");
    } catch (e) {
      // Importer role may not have list permission; keep form usable.
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("access denied") || msg.includes("403")) return [];
      throw e;
    }
  },
  create: async (payload) => {
    try {
      return await api.post("/importers", payload);
    } catch (e) {
      if (String(e.message).toLowerCase().includes("access denied")) {
        // Fallback for Importer role
        return await api.post("/importers/self", payload);
      }
      throw e;
    }
  },
};
