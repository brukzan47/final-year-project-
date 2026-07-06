import express from "express";
import { createImporterSelf } from "../controller/importerController.js";
import { validateImporter } from "../middleware/importerValidation.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Self-registration endpoint (rate-limited)
router.post("/self", rateLimit({ windowMs: 60_000, max: 5 }), validateImporter, createImporterSelf);

export default router;
