import express from "express";
import { getPerformanceRecords, createPerformanceRecord } from "../controller/performanceController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// GET performance metrics
// Allow Customs Officer to view, to match frontend route permissions
router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Risk Analyst", "Auditor"), getPerformanceRecords);

// POST new performance record
router.post("/", verifyToken, authorizeRoles("Admin", "Customs Officer"), createPerformanceRecord);

export default router;


