import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import {
  adminResetUserPassword,
  createUser,
  getUserRoleAudit,
  getUserDetails,
  getUserImporterRecord,
  getUsers,
  updateUserRole,
  updateUserStatus,
} from "../controller/userController.js";

const router = express.Router();

router.get("/", verifyToken, authorizeRoles("Admin", "Customs Officer"), getUsers);
router.get("/role-audit", verifyToken, authorizeRoles("Admin"), getUserRoleAudit);
router.get("/:id", verifyToken, authorizeRoles("Admin"), getUserDetails);
router.get("/:id/importer-record", verifyToken, authorizeRoles("Admin", "Customs Officer"), getUserImporterRecord);
router.post("/", verifyToken, authorizeRoles("Admin", "Customs Officer"), createUser);
router.patch("/:id/role", verifyToken, authorizeRoles("Admin"), updateUserRole);
router.patch("/:id/status", verifyToken, authorizeRoles("Admin"), updateUserStatus);
router.patch("/:id/reset-password", verifyToken, authorizeRoles("Admin"), adminResetUserPassword);

export default router;
