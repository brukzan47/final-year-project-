export const RISK_CHANNELS = {
  GREEN: "Green",
  YELLOW: "Yellow",
  RED: "Red",
};

export const RISK_THRESHOLDS = {
  greenMax: 34,
  yellowMax: 64,
  redMin: 65,
};

export const HS_CATEGORY_WEIGHTS = [
  { name: "Chemicals", weight: 25, prefixes: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"] },
  { name: "Vehicles", weight: 20, prefixes: ["87"] },
  { name: "Electronics", weight: 15, prefixes: ["84", "85"] },
  { name: "Aircraft Parts", weight: 5, prefixes: ["88"] },
];

export const COUNTRY_RISK = {
  highRiskTradeZone: {
    weight: 20,
    countries: ["Somalia", "Yemen", "Afghanistan", "Syria", "Libya"],
  },
  sanctionSensitive: {
    weight: 30,
    countries: ["Iran", "North Korea", "Sudan", "Russia", "Belarus"],
  },
  trustedTradePartner: {
    weight: 3,
    countries: ["Kenya", "Djibouti", "UAE", "Germany", "Netherlands", "China", "India"],
  },
  default: { weight: 5 },
};

export const IMPORTER_HISTORY = {
  newImporter: 8,
  previousPenalty: 25,
  cleanHistory: 0,
};

export const VALUE_ANOMALY = {
  suspiciousLowThreshold: 0.6,
  suspiciousLowWeight: 30,
};

export const FREQUENCY_SPIKE = {
  lookbackDays: 14,
  minHighValueDeclarations: 3,
  highValueThresholdUsd: 100000,
  weight: 15,
};
