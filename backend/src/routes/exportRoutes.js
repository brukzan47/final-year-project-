import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { ExportController } from "../controller/exportController.js";

const router = express.Router();

router.get(
  "/goods.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.goodsCsv
);

router.post(
  "/dashboard.pdf",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.dashboardPdf
);

router.get(
  "/revenue.csv",
  verifyToken,
  authorizeRoles("Admin"),
  ExportController.revenueCsv
);

router.get(
  "/risk-channels.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.riskCsv
);

router.get(
  "/sector-volume.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.sectorCsv
);

router.get(
  "/top-countries.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.countriesCsv
);

router.get(
  "/clearance-avg.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.clearanceAvgCsv
);

router.get(
  "/risky-items.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.riskyItemsCsv
);

router.get(
  "/declarations-invalid.csv",
  verifyToken,
  authorizeRoles("Admin"),
  ExportController.declarationsInvalidCsv
);

router.get(
  "/declarations.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.declarationsCsv
);

router.get(
  "/declarations-by-station.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.declarationsByStationCsv
);

router.get(
  "/declarations-by-port.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.declarationsByPortCsv
);

router.get(
  "/devices.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  ExportController.devicesCsv
);

export default router;

