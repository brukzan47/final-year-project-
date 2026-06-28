import { api, getApiBase, getToken } from "./client.js";

export const ImporterTrackingAPI = {
  search: (q) => api.get(`/importer/tracking/search?q=${encodeURIComponent(q)}`),
  streamUrl: (shipmentId) => {
    const token = getToken();
    const qp = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${getApiBase()}/tracking/${encodeURIComponent(shipmentId)}/stream${qp}`;
  },
  downloadReleaseDocs: async (declarationId) => {
    const token = getToken();
    const res = await fetch(`${getApiBase()}/importer/tracking/release-docs/${encodeURIComponent(declarationId)}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch {}
      throw new Error(msg);
    }
    return res.blob();
  },
};
