import express from "express";
import { getImporters, createImporter, approveImporter } from "../controller/importerController.js";
import { verifyToken, requirePermission } from "../middleware/auth.js";
import { validateImporter } from "../middleware/importerValidation.js";

const router = express.Router();

// GET all importers (requires permission importers:read)
router.get("/", verifyToken, requirePermission("importers:read"), getImporters);

// POST create new importer (requires permission importers:create)
router.post("/", verifyToken, requirePermission("importers:create"), validateImporter, createImporter);

// POST approve importer (admin action) - requires permission importers:approve
router.post("/:id/approve", verifyToken, requirePermission("importers:approve"), approveImporter);

export default router;
