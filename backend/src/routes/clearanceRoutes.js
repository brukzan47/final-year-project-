import express from "express";
import { getClearances, createClearance, getReadinessQueue, getClearanceById, getReleaseNote } from "../controller/clearanceController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Clearance Officer"), getClearances);

router.get(
  "/readiness",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Clearance Officer"),
  getReadinessQueue
);

router.get(
  "/:id/release-note",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Clearance Officer"),
  getReleaseNote
);

router.get(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Clearance Officer"),
  getClearanceById
);

router.post("/", verifyToken, authorizeRoles("Customs Officer", "Admin", "Clearance Officer"), createClearance);

export default router;
