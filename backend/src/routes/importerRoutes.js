import express from "express";
import { getImporters, createImporter } from "../controller/importerController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { validateImporter } from "../middleware/importerValidation.js";

const router = express.Router();

// GET all importers (Admin / Officer)
router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer"), getImporters);

// POST create new importer
router.post("/", verifyToken, authorizeRoles("Admin", "Customs Officer"), validateImporter, createImporter);

export default router;

