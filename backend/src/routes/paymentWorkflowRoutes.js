import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { reverify } from "../controller/paymentWorkflowController.js";
import { verify as verifyPayment, reject as rejectPayment, approve as approvePayment } from "../controller/paymentWorkflowController.js";

const router = express.Router();

// Finance can reset a failed payment back to Pending
router.post(
  "/:id/reverify",
  verifyToken,
  authorizeRoles("Finance Officer"),
  reverify
);

// Manual verify (officer) - match frontend PUT call
router.put(
  "/:id/verify",
  verifyToken,
  authorizeRoles("Finance Officer"),
  verifyPayment
);

// Reject a pending payment -> mark Failed
router.put(
  "/:id/reject",
  verifyToken,
  authorizeRoles("Finance Officer"),
  rejectPayment
);

// Approve a verified payment -> mark Paid
router.put(
  "/:id/approve",
  verifyToken,
  authorizeRoles("Finance Officer"),
  approvePayment
);

export default router;
