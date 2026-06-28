import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { LocationController } from "../controller/locationController.js";

const router = express.Router();

// List locations (Admin, Customs Officer)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  LocationController.list
);

router.get(
  "/csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  LocationController.exportCsv
);

// Create or upsert a location (Admin only)
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin"),
  express.json({ type: "application/json" }),
  LocationController.create
);

router.post(
  "/import-csv",
  verifyToken,
  authorizeRoles("Admin"),
  express.json({ type: "application/json" }),
  LocationController.importCsv
);

// Update by name (Admin only)
router.patch(
  "/:name",
  verifyToken,
  authorizeRoles("Admin"),
  express.json({ type: "application/json" }),
  LocationController.update
);

// Delete by name (Admin only)
router.delete(
  "/:name",
  verifyToken,
  authorizeRoles("Admin"),
  LocationController.remove
);

export default router;

