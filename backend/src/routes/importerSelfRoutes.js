import express from "express";
import { createImporter } from "../controller/importerController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// Allow Importer to create own profile; Admin/Officer may also use this endpoint
router.post("/self", verifyToken, authorizeRoles("Importer", "Admin", "Customs Officer"), createImporter);

export default router;

