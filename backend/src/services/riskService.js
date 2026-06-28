import { RISK_CONFIG } from "../config/risk.js";
import { scoreRisk as fallbackScore } from "../utils/risk.js";

async function callRiskService(path, payload, method = "POST") {
  const url = `${RISK_CONFIG.serviceUrl}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Risk service ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

export const RiskService = {
  async score(payload) {
    const apiRes = await callRiskService("/score", payload);
    if (!apiRes || apiRes.error) {
      // Fallback to simple rule-based scoring using existing utils
      const { shipment = {}, performance = null } = payload || {};
      const f = fallbackScore({ shipment, performance });
      return {
        risk_score: Math.min(Math.max(f.score, 0), 100),
        channel: f.channel.toLowerCase(),
        reasons: (f.reasons || []).map((r) => ({ feature: r, impact: null, direction: null })),
        model_version: "fallback",
      };
    }
    return apiRes;
  },

  async feedback(payload) {
    const apiRes = await callRiskService("/feedback", payload);
    return apiRes;
  },
};

