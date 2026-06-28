import { api } from "./client.js";

export const AnalyticsAPI = {
  revenueTrends: (params = {}) => api.get(`/analytics/revenue-trends${toQuery(params)}`),
  riskChannels: (params = {}) => api.get(`/analytics/risk-channels${toQuery(params)}`),
  pendingVsCleared: (params = {}) => api.get(`/analytics/pending-vs-cleared${toQuery(params)}`),
  clearanceAvg: (by = "port", params = {}) => api.get(`/analytics/clearance-time/average${toQuery({ ...params, by })}`),
  goodsSummary: (params = {}) => api.get(`/analytics/goods-summary${toQuery(params)}`),
  sectorVolume: (params = {}) => api.get(`/analytics/sector-volume${toQuery(params)}`),
  topCountries: (params = {}) => api.get(`/analytics/top-countries${toQuery(params)}`),
  forecastRevenue: (horizon = 3, params = {}) => api.get(`/analytics/forecast/revenue-monthly${toQuery({ ...params, horizon })}`),
  anomaliesLowDecls: (params = {}) => api.get(`/analytics/anomalies/low-declarations${toQuery(params)}`),
  declarations: (params = {}) => api.get(`/analytics/declarations${toQuery(params)}`),
  highRiskHsCodes: (params = {}) => api.get(`/analytics/high-risk-hs-codes${toQuery(params)}`),
  topRiskyImporters: (params = {}) => api.get(`/analytics/top-risky-importers${toQuery(params)}`),
  countryRiskHeatmap: (params = {}) => api.get(`/analytics/country-risk-heatmap${toQuery(params)}`),
};

function toQuery(obj) {
  const entries = Object.entries(obj || {}).filter(([_, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  const search = new URLSearchParams(entries.map(([k, v]) => [k, v]));
  return `?${search.toString()}`;
}
