import express from "express";
import { getInspections, createInspection } from "../controller/inspectionController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { validateInspection } from "../middleware/inspectionValidation.js";

const router = express.Router();

// GET all inspections
router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Inspector"), getInspections);

// POST new inspection record
router.post("/", verifyToken, authorizeRoles("Customs Officer", "Admin", "Inspector"), validateInspection, createInspection);

export default router;

