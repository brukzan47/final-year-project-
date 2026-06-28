import express from "express";
import { getShipments, createShipment, updateShipment, findShipmentByRef, regenerateShipmentReference, backfillShipmentReferences, reportInvalidReferences } from "../controller/shipmentController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// GET all shipments
router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"), getShipments);

// POST create shipment
router.post("/", verifyToken, authorizeRoles("Importer", "Admin"), createShipment);

// PATCH update shipment (tracking_ref etc.)
router.patch("/:id", verifyToken, authorizeRoles("Importer", "Admin", "Customs Officer"), updateShipment);

// Quick find by reference or tracking_ref
router.get("/find", verifyToken, authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"), findShipmentByRef);

// Admin: regenerate a shipment reference
router.post(
  "/:id/regenerate-reference",
  verifyToken,
  authorizeRoles("Admin"),
  regenerateShipmentReference
);

// Admin: backfill missing/invalid shipment references
router.post(
  "/maintenance/backfill-references",
  verifyToken,
  authorizeRoles("Admin"),
  backfillShipmentReferences
);

// Admin: report invalid and duplicate shipment references
router.get(
  "/maintenance/report-invalid-references",
  verifyToken,
  authorizeRoles("Admin"),
  reportInvalidReferences
);

export default router;


