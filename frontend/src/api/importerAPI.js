import { api } from "./client.js";

function cleanImporterPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

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
    const body = cleanImporterPayload(payload);
    try {
      return await api.post("/importers", body);
    } catch (e) {
      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("access denied") || msg.includes("not allowed") || msg.includes("403")) {
        // Fallback for Importer role
        return await api.post("/importers/self", body);
      }
      throw e;
    }
  },
};
