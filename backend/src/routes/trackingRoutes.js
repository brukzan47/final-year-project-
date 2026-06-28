import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import {
  getTracking,
  sseStream,
  updateTracking,
  eslWebhook,
  getTrail,
  gpsIngest,
  registerDevice,
  listDevices,
  listLocations,
  demoSimulate,
  demoArrive,
} from "../controller/trackingController.js";

// Allow EventSource to send token via query (?token=..)
function sseAuthShim(req, _res, next) {
  if (!req.headers.authorization && req.query && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

const router = express.Router();

// Place static routes before parameterized ones to avoid '/:shipmentId' catching them
// Webhook endpoint for ESL provider
router.post("/webhook/esl", express.json({ type: "application/json" }), eslWebhook);

// GPS ingest (provider → system) using shared secret header `x-gps-secret`
router.post("/ingest", express.json({ type: "application/json" }), gpsIngest);

// Device registry (Admin/Officer)
router.get("/devices", verifyToken, authorizeRoles("Admin", "Customs Officer", "Port Officer"), listDevices);
router.post("/devices", verifyToken, authorizeRoles("Admin", "Customs Officer", "Port Officer"), registerDevice);

// Locations for map/tooling
router.get(
  "/locations",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  listLocations
);

// Demo simulation (Admin/Officer)
router.post(
  "/demo/simulate",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  express.json({ type: "application/json" }),
  demoSimulate
);
router.post(
  "/demo/arrive",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  express.json({ type: "application/json" }),
  demoArrive
);

// Get current tracking snapshot
router.get(
  "/:shipmentId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getTracking
);

// Real-time stream via SSE
router.get(
  "/:shipmentId/stream",
  sseAuthShim,
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  sseStream
);

// Update tracking (for system integrations/webhooks)
router.post(
  "/:shipmentId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  updateTracking
);

// Recent trail
router.get(
  "/:shipmentId/trail",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getTrail
);

export default router;


