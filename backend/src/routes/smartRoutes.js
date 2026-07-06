import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { smartSearch, smartIndexRebuild, smartSuggestHs, smartEstimateValue, smartOcrExtract, smartSearchCsv } from "../controller/smartController.js";

const router = express.Router();

router.get(
  "/search",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor", "Importer"),
  smartSearch
);

router.get(
  "/search.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor", "Importer"),
  smartSearchCsv
);

router.post(
  "/admin/reindex",
  verifyToken,
  authorizeRoles("Admin"),
  smartIndexRebuild
);

router.post(
  "/suggest/hs-code",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor", "Importer"),
  express.json({ type: "application/json" }),
  smartSuggestHs
);

router.post(
  "/suggest/value",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor", "Importer"),
  express.json({ type: "application/json" }),
  smartEstimateValue
);

router.post(
  "/ocr/extract",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Risk Analyst", "Auditor", "Importer"),
  express.json({ type: "application/json" }),
  smartOcrExtract
);

export default router;


