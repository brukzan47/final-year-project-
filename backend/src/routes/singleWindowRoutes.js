import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { getSingleWindowStatus, exportSingleWindowCsv, getSingleWindowPollerStatus } from "../controller/singleWindowController.js";

const router = express.Router();

router.get(
  "/export.csv",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  exportSingleWindowCsv
);

router.get(
  "/status",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer"),
  getSingleWindowPollerStatus
);

router.get(
  "/:declarationId",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Port Officer", "Importer"),
  getSingleWindowStatus
);

export default router;

