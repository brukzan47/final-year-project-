import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { AnalyticsController } from "../controller/analyticsController.js";

const router = express.Router();

router.get(
  "/revenue-trends",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.revenueTrends
);

router.get(
  "/risk-channels",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.riskChannels
);

router.get(
  "/pending-vs-cleared",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.pendingVsCleared
);

router.get(
  "/clearance-time/average",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.clearanceAvg
);

router.get(
  "/goods-summary",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.goodsSummary
);

router.get(
  "/sector-volume",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.sectorVolume
);

router.get(
  "/top-countries",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.topCountries
);

router.get(
  "/forecast/revenue-monthly",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.forecastRevenueMonthly
);

router.get(
  "/anomalies/low-declarations",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.anomaliesLowDeclarations
);

router.get(
  "/declarations",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.declarationsList
);

router.get(
  "/high-risk-hs-codes",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.highRiskHsCodes
);

router.get(
  "/top-risky-importers",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.topRiskyImporters
);

router.get(
  "/country-risk-heatmap",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  AnalyticsController.countryRiskHeatmap
);

export default router;

