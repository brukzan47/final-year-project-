import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { createTransportLink, getTransportLink, transportWebhook, getTransportEvents, exportTransportEventsCsv } from "../controller/transportController.js";

const router = express.Router();

router.post(
  "/links",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  express.json({ type: "application/json" }),
  createTransportLink
);

router.get(
  "/links/:shipmentId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getTransportLink
);

router.get(
  "/links/:shipmentId/events",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getTransportEvents
);

router.get(
  "/links/:shipmentId/events.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  exportTransportEventsCsv
);

router.post("/webhook", express.json({ type: "application/json" }), transportWebhook);

export default router;

