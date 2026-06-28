import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { requestFxApproval, getFxStatus, nbeWebhook } from "../controller/nbeController.js";

const router = express.Router();

router.post(
  "/fx/approvals",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Importer"),
  express.json({ type: "application/json" }),
  requestFxApproval
);

router.get(
  "/fx/approvals/:declarationId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Importer"),
  getFxStatus
);

router.post("/fx/webhook", express.json({ type: "application/json" }), nbeWebhook);

export default router;
