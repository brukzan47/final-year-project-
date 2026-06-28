import express from "express";
import { verifyToken } from "../../middleware/auth.js";
import { authorizeRoles } from "../../middleware/roleCheck.js";
import { RiskEngineController } from "./risk.controller.js";

const router = express.Router();

router.post(
  "/score",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  RiskEngineController.score
);

router.get(
  "/explain/:declaration_id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  RiskEngineController.explain
);

router.get(
  "/queues",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  RiskEngineController.queues
);

router.get(
  "/declarations",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"),
  RiskEngineController.listDeclarations
);

router.post(
  "/backfill",
  verifyToken,
  authorizeRoles("Admin"),
  RiskEngineController.backfill
);

export default router;

