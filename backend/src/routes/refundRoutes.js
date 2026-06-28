import express from "express";
import { createRefund, listRefunds, updateRefundStatus } from "../controller/refundController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizePermission, authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.get("/", verifyToken, authorizeRoles("Admin", "Finance Officer"), listRefunds);
router.post("/", verifyToken, authorizeRoles("Admin", "Finance Officer", "Importer"), createRefund);
router.patch("/:id/status", verifyToken, authorizePermission("APPROVE_REFUNDS"), updateRefundStatus);

export default router;
