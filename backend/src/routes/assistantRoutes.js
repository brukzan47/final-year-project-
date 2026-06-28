import express from "express";
import { assistantChat } from "../controller/assistantController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.post("/chat", verifyToken, authorizeRoles("Admin", "Customs Officer", "Importer"), assistantChat);

export default router;
