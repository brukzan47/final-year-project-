import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { SystemHealthController } from "../controller/systemHealthController.js";

const router = express.Router();

router.get("/summary", verifyToken, authorizeRoles("Admin"), SystemHealthController.summary);
router.get("/", verifyToken, authorizeRoles("Admin"), SystemHealthController.get);

export default router;
