import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { requestTradePermit, getTradePermit, tradeWebhook } from "../controller/tradeController.js";

const router = express.Router();

router.post(
  "/permits",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  express.json({ type: "application/json" }),
  requestTradePermit
);

router.get(
  "/permits/:declarationId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getTradePermit
);

router.post("/webhook", express.json({ type: "application/json" }), tradeWebhook);

export default router;

