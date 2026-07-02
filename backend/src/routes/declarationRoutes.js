import express from "express";
import { getDeclarations, createDeclaration, approveDeclaration, rejectDeclaration, findByNumber, reportInvalidNumbers, regenerateNumber, importNumbers } from "../controller/declarationController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// GET all declarations
router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor", "Importer"), getDeclarations);

// POST create declaration
router.post("/", verifyToken, authorizeRoles("Admin", "Importer", "Customs Officer"), createDeclaration);

// Approve/Reject declaration (Admin, Customs Officer)
router.post(
  "/:id/approve",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer"),
  approveDeclaration
);

router.post(
  "/:id/reject",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer"),
  rejectDeclaration
);

// Find declaration by number
router.get(
  "/find",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor", "Importer"),
  findByNumber
);

// Admin report: invalid/duplicate declaration numbers
router.get(
  "/maintenance/report-invalid-numbers",
  verifyToken,
  authorizeRoles("Admin"),
  reportInvalidNumbers
);

// Admin: regenerate a declaration number
router.post(
  "/:id/regenerate-number",
  verifyToken,
  authorizeRoles("Admin"),
  regenerateNumber
);

// Admin: import declaration numbers (JSON or CSV in body)
router.post(
  "/maintenance/import-numbers",
  verifyToken,
  authorizeRoles("Admin"),
  importNumbers
);

export default router;


