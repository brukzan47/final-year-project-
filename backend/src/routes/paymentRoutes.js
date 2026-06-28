import express from "express";
import { getPayments, createPayment, getPaymentAccountingLedger, getPaymentAuditLogs, getPaymentLedger, getPaymentReceipt, getPaymentsSummary, getPaymentById } from "../controller/paymentController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizePermission } from "../middleware/roleCheck.js";
import { validatePayment } from "../middleware/paymentValidation.js";

const router = express.Router();

// GET all payments (Importers only see their own)
router.get("/", verifyToken, authorizePermission("VIEW_PAYMENTS"), getPayments);

// Summary for dashboard (finance/admin)
router.get(
  "/summary",
  verifyToken,
  authorizePermission("VIEW_REVENUE_REPORTS"),
  getPaymentsSummary
);

router.get(
  "/audit-logs",
  verifyToken,
  authorizePermission("VIEW_REVENUE_REPORTS"),
  getPaymentAuditLogs
);

router.get(
  "/ledger/accounting",
  verifyToken,
  authorizePermission("VIEW_REVENUE_REPORTS"),
  getPaymentAccountingLedger
);

router.get(
  "/ledger",
  verifyToken,
  authorizePermission("VIEW_REVENUE_REPORTS"),
  getPaymentLedger
);

router.get(
  "/:id",
  verifyToken,
  authorizePermission("VIEW_PAYMENTS"),
  getPaymentById
);

// POST create payment
router.post(
  "/",
  verifyToken,
  authorizePermission("VERIFY_PAYMENTS"),
  validatePayment,
  createPayment
);

// GET payment receipt (if available)
router.get(
  "/:id/receipt",
  verifyToken,
  authorizePermission("GENERATE_RECEIPTS"),
  getPaymentReceipt
);

export default router;
