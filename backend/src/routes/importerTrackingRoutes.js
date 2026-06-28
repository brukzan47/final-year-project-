import express from "express";
import { importerTrackingSearch, downloadReleaseDocs } from "../controller/importerTrackingController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.get("/search", verifyToken, authorizeRoles("Importer", "Admin", "Customs Officer"), importerTrackingSearch);
router.get("/release-docs/:declarationId", verifyToken, authorizeRoles("Importer", "Admin", "Customs Officer"), downloadReleaseDocs);

export default router;
