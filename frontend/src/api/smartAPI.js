import { api } from "./client.js";

export const SmartAPI = {
  search: ({ q, types = [], page = 1, size = 50, origin, destination, decl_status, station, date_from, date_to }) => api.get(`/smart/search?q=${encodeURIComponent(q||'')}&types=${encodeURIComponent(types.join(','))}&page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}${origin?`&origin=${encodeURIComponent(origin)}`:''}${destination?`&destination=${encodeURIComponent(destination)}`:''}${decl_status?`&decl_status=${encodeURIComponent(decl_status)}`:''}${station?`&station=${encodeURIComponent(station)}`:''}${date_from?`&date_from=${encodeURIComponent(date_from)}`:''}${date_to?`&date_to=${encodeURIComponent(date_to)}`:''}`),
  reindex: () => api.post(`/smart/admin/reindex`, {}),
  suggestHs: (payload) => api.post(`/smart/suggest/hs-code`, payload),
  estimateValue: (payload) => api.post(`/smart/suggest/value`, payload),
  ocrExtract: (payload) => api.post(`/smart/ocr/extract`, payload),
};
