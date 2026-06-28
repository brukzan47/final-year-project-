export const RISK_CONFIG = {
  serviceUrl: process.env.RISK_SERVICE_URL || "http://localhost:8010",
  thresholds: { green: 0.41, yellow: 0.7 },
  modelVersion: process.env.RISK_MODEL_VERSION || "v1.0",
};

