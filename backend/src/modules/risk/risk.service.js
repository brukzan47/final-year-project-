import { pool } from "../../config/db.js";
import { RiskModel } from "./risk.model.js";
import {
  COUNTRY_RISK,
  FREQUENCY_SPIKE,
  HS_CATEGORY_WEIGHTS,
  IMPORTER_HISTORY,
  RISK_CHANNELS,
  RISK_THRESHOLDS,
  VALUE_ANOMALY,
} from "./risk.rules.js";

function norm(value) {
  return String(value || "").trim();
}

function normLower(value) {
  return norm(value).toLowerCase();
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hsFactor(hsCode, goodsType) {
  const hs = norm(hsCode);
  const goods = normLower(goodsType);

  for (const cat of HS_CATEGORY_WEIGHTS) {
    if (cat.prefixes.some((p) => hs.startsWith(p))) {
      return { key: "hs_risk", label: cat.name, points: cat.weight, reason: `HS category ${cat.name} (+${cat.weight})` };
    }
  }

  if (goods.includes("chemical")) return { key: "hs_risk", label: "Chemicals", points: 25, reason: "HS category Chemicals (+25)" };
  if (goods.includes("vehicle") || goods.includes("automotive")) return { key: "hs_risk", label: "Vehicles", points: 20, reason: "HS category Vehicles (+20)" };
  if (goods.includes("electronic")) return { key: "hs_risk", label: "Electronics", points: 15, reason: "HS category Electronics (+15)" };
  if (goods.includes("aircraft") || goods.includes("aviation")) return { key: "hs_risk", label: "Aircraft Parts", points: 5, reason: "HS category Aircraft Parts (+5)" };

  return { key: "hs_risk", label: "Unknown", points: 0, reason: "HS category not in risk map (+0)" };
}

function countryFactor(originCountry) {
  const c = norm(originCountry);
  const lower = c.toLowerCase();

  if (COUNTRY_RISK.sanctionSensitive.countries.some((x) => x.toLowerCase() === lower)) {
    return {
      key: "country_risk",
      label: "Sanction-sensitive",
      points: COUNTRY_RISK.sanctionSensitive.weight,
      reason: `Country risk: sanction-sensitive (+${COUNTRY_RISK.sanctionSensitive.weight})`,
    };
  }
  if (COUNTRY_RISK.highRiskTradeZone.countries.some((x) => x.toLowerCase() === lower)) {
    return {
      key: "country_risk",
      label: "High-risk trade zone",
      points: COUNTRY_RISK.highRiskTradeZone.weight,
      reason: `Country risk: high-risk trade zone (+${COUNTRY_RISK.highRiskTradeZone.weight})`,
    };
  }
  if (COUNTRY_RISK.trustedTradePartner.countries.some((x) => x.toLowerCase() === lower)) {
    return {
      key: "country_risk",
      label: "Trusted trade partner",
      points: COUNTRY_RISK.trustedTradePartner.weight,
      reason: `Country risk: trusted trade partner (+${COUNTRY_RISK.trustedTradePartner.weight})`,
    };
  }

  return {
    key: "country_risk",
    label: "Standard monitoring",
    points: COUNTRY_RISK.default.weight,
    reason: `Country risk: standard monitoring (+${COUNTRY_RISK.default.weight})`,
  };
}

function channelFromScore(score) {
  if (score >= RISK_THRESHOLDS.redMin) return RISK_CHANNELS.RED;
  if (score > RISK_THRESHOLDS.greenMax && score <= RISK_THRESHOLDS.yellowMax) return RISK_CHANNELS.YELLOW;
  return RISK_CHANNELS.GREEN;
}

async function getDeclarationContext(declarationId) {
  const q = await pool.query(
    `SELECT d.declaration_id, d.declaration_no, d.declaration_date,
            s.shipment_id, s.importer_id, s.hs_code, s.goods_type, s.cif_value_usd, s.origin_country,
            s.destination_port, s.mode_of_transport, s.quantity, s.unit_of_measure,
            i.company_name,
            perf.penalties
     FROM declarations d
     JOIN shipments s ON s.shipment_id = d.shipment_id
     LEFT JOIN importers i ON i.importer_id = s.importer_id
     LEFT JOIN LATERAL (
       SELECT p.penalties
       FROM performance p
       WHERE p.importer_id = s.importer_id
       ORDER BY p.created_at DESC
       LIMIT 1
     ) perf ON true
     WHERE d.declaration_id = $1
     LIMIT 1`,
    [declarationId]
  );
  return q.rows[0] || null;
}

async function getMarketAverageUnitPrice({ hsCode, originCountry, unit }) {
  if (!hsCode) return null;
  try {
    const q = await pool.query(
      `SELECT p50_value_usd
       FROM reference_prices
       WHERE hs_code = $1
         AND ($2::text IS NULL OR origin_country = $2)
         AND ($3::text IS NULL OR unit_of_measure = $3)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [hsCode, originCountry || null, unit || null]
    );
    return toNum(q.rows[0]?.p50_value_usd);
  } catch {
    return null;
  }
}

async function importerHistoryFactors({ importerId }) {
  if (!importerId) {
    return {
      points: 0,
      reason: "Importer history unavailable (+0)",
      labels: ["unavailable"],
    };
  }

  const countQ = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM declarations d
     JOIN shipments s ON s.shipment_id = d.shipment_id
     WHERE s.importer_id = $1`,
    [importerId]
  );
  const total = Number(countQ.rows[0]?.total || 0);

  const perfQ = await pool.query(
    `SELECT penalties
     FROM performance
     WHERE importer_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [importerId]
  );

  const penalties = normLower(perfQ.rows[0]?.penalties || "");
  const hasPenalty = penalties && penalties !== "none" && penalties !== "no";

  if (hasPenalty) {
    return {
      points: IMPORTER_HISTORY.previousPenalty,
      reason: `Importer history: previous penalty (+${IMPORTER_HISTORY.previousPenalty})`,
      labels: ["previous_penalty"],
    };
  }
  if (total <= 1) {
    return {
      points: IMPORTER_HISTORY.newImporter,
      reason: `Importer history: new importer (+${IMPORTER_HISTORY.newImporter})`,
      labels: ["new_importer"],
    };
  }

  return {
    points: IMPORTER_HISTORY.cleanHistory,
    reason: "Importer history: clean (+0)",
    labels: ["clean"],
  };
}

async function frequencySpikeFactor({ importerId }) {
  if (!importerId) return { points: 0, reason: "Frequency check unavailable (+0)" };

  const q = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM declarations d
     JOIN shipments s ON s.shipment_id = d.shipment_id
     WHERE s.importer_id = $1
       AND COALESCE(s.cif_value_usd, 0) >= $2
       AND d.declaration_date >= (CURRENT_DATE - ($3::int * INTERVAL '1 day'))`,
    [importerId, FREQUENCY_SPIKE.highValueThresholdUsd, FREQUENCY_SPIKE.lookbackDays]
  );

  const count = Number(q.rows[0]?.cnt || 0);
  if (count >= FREQUENCY_SPIKE.minHighValueDeclarations) {
    return {
      points: FREQUENCY_SPIKE.weight,
      reason: `Frequency spike: ${count} high-value declarations in ${FREQUENCY_SPIKE.lookbackDays} days (+${FREQUENCY_SPIKE.weight})`,
    };
  }

  return { points: 0, reason: "Frequency spike: normal (+0)" };
}

function valueAnomalyFactor({ declaredValue, marketAverageValue }) {
  const dec = toNum(declaredValue);
  const avg = toNum(marketAverageValue);

  if (!dec || !avg || avg <= 0) return { points: 0, reason: "Value anomaly: market baseline unavailable (+0)" };

  if (dec < avg * VALUE_ANOMALY.suspiciousLowThreshold) {
    return {
      points: VALUE_ANOMALY.suspiciousLowWeight,
      reason: `Value anomaly: declared ${dec.toFixed(2)} < ${Math.round(VALUE_ANOMALY.suspiciousLowThreshold * 100)}% of expected (${avg.toFixed(2)}) (+${VALUE_ANOMALY.suspiciousLowWeight})`,
    };
  }

  return { points: 0, reason: "Value anomaly: within expected range (+0)" };
}

export const RiskEngineService = {
  async calculateRisk(input) {
    const hs = hsFactor(input.hs_code, input.goods_type);
    const country = countryFactor(input.origin_country);
    const history = await importerHistoryFactors({ importerId: input.importer_id });

    const marketAvgUnit = await getMarketAverageUnitPrice({
      hsCode: input.hs_code,
      originCountry: input.origin_country,
      unit: input.unit_of_measure,
    });

    const qty = toNum(input.quantity) || 1;
    const marketAverageValue = marketAvgUnit ? marketAvgUnit * qty : null;
    const anomaly = valueAnomalyFactor({ declaredValue: input.cif_value_usd, marketAverageValue });
    const spike = await frequencySpikeFactor({ importerId: input.importer_id });

    const factors = [
      { key: hs.key, points: hs.points, reason: hs.reason },
      { key: country.key, points: country.points, reason: country.reason },
      { key: "importer_history", points: history.points, reason: history.reason },
      { key: "value_anomaly", points: anomaly.points, reason: anomaly.reason },
      { key: "frequency_spike", points: spike.points, reason: spike.reason },
    ];

    const rawScore = factors.reduce((a, f) => a + (Number(f.points) || 0), 0);
    const riskScore = Math.max(0, Math.min(100, rawScore));
    const riskChannel = channelFromScore(riskScore);

    return {
      risk_score: riskScore,
      risk_channel: riskChannel,
      risk_reason: factors.map((x) => x.reason).join("; "),
      factors,
      market_average_value: marketAverageValue,
      model_version: "phase1-rule-ai",
    };
  },

  async scoreDeclaration(declarationId) {
    const ctx = await getDeclarationContext(declarationId);
    if (!ctx) return null;
    return this.calculateRisk(ctx);
  },

  async scoreAndPersist(declarationId) {
    const scored = await this.scoreDeclaration(declarationId);
    if (!scored) return null;

    await pool.query(
      `UPDATE declarations
       SET risk_score = $2,
           risk_channel = $3,
           risk_reason = $4
       WHERE declaration_id = $1`,
      [declarationId, scored.risk_score, scored.risk_channel, scored.risk_reason]
    );

    await RiskModel.recordRiskDecision({
      declarationId,
      score: scored.risk_score,
      channel: scored.risk_channel,
      reasons: scored.factors,
      modelVersion: scored.model_version,
      features: { declaration_id: declarationId },
    });

    return scored;
  },

  async listQueues(limit = 50) {
    const lim = Math.max(1, Math.min(Number(limit) || 50, 200));
    const q = await pool.query(
      `WITH inspected AS (
         SELECT DISTINCT declaration_id FROM inspections
       )
       SELECT d.declaration_id, d.declaration_no, d.declaration_date,
              COALESCE(d.risk_score, 0) AS risk_score,
              COALESCE(d.risk_channel, 'Green') AS risk_channel,
              d.risk_reason,
              s.hs_code, s.origin_country, s.cif_value_usd,
              i.company_name
       FROM declarations d
       JOIN shipments s ON s.shipment_id = d.shipment_id
       JOIN importers i ON i.importer_id = s.importer_id
       LEFT JOIN inspected x ON x.declaration_id = d.declaration_id
       WHERE x.declaration_id IS NULL
       ORDER BY COALESCE(d.risk_score, 0) DESC, d.declaration_date DESC
       LIMIT ${lim}`
    );

    const rows = q.rows || [];
    const high = rows.filter((r) => normLower(r.risk_channel) === "red");
    const medium = rows.filter((r) => normLower(r.risk_channel) === "yellow");
    const low = rows.filter((r) => normLower(r.risk_channel) === "green");

    return {
      high_risk_queue: high,
      medium_risk_queue: medium,
      low_risk_queue: low,
      totals: {
        high: high.length,
        medium: medium.length,
        low: low.length,
      },
    };
  },
};

