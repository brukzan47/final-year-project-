import { Payment } from "../models/Payment.js";
import { PaymentRefund } from "../models/PaymentRefund.js";
import { PaymentLedger } from "../models/PaymentLedger.js";
import { audit } from "../utils/audit.js";

const Statuses = new Set(["Finance Review", "Approved", "Gateway Refund", "Completed", "Rejected"]);

export const listRefunds = async (_req, res) => {
  try {
    res.json(await PaymentRefund.list());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createRefund = async (req, res) => {
  try {
    const { payment_id, amount, reason, notes } = req.body || {};
    if (!payment_id) return res.status(400).json({ message: "payment_id is required" });
    if (!reason) return res.status(400).json({ message: "reason is required" });

    const payment = await Payment.getById(payment_id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (String(payment.payment_status) !== "Paid") {
      return res.status(409).json({ message: "Refunds can only be requested for Paid payments" });
    }

    const refundAmount = Number(amount || payment.paid_amount || payment.total_payable || 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({ message: "amount must be greater than zero" });
    }

    const refund = await PaymentRefund.create({
      payment_id,
      declaration_id: payment.declaration_id,
      amount: refundAmount,
      reason,
      requested_by: req.user?.id || req.user?.email || null,
      notes,
    });
    await Payment.appendEvent(payment_id, "refund_requested", req.user?.id || req.user?.email || null, {
      refund_id: refund.refund_id,
      amount: refund.amount,
      reason,
    });
    await audit(req, {
      action: "refund_requested",
      entityType: "refund",
      entityId: refund.refund_id,
      reason,
      after: { payment_id, amount: refund.amount, status: refund.status },
    });
    res.status(201).json(refund);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateRefundStatus = async (req, res) => {
  try {
    const { status, gateway_ref, notes } = req.body || {};
    if (!Statuses.has(status)) return res.status(400).json({ message: "Invalid refund status" });

    const refund = await PaymentRefund.updateStatus(req.params.id, {
      status,
      gateway_ref,
      notes,
      reviewed_by: req.user?.id || req.user?.email || null,
    });
    if (!refund) return res.status(404).json({ message: "Refund not found" });

    await Payment.appendEvent(refund.payment_id, "refund_status_updated", req.user?.id || req.user?.email || null, {
      refund_id: refund.refund_id,
      status,
      gateway_ref: gateway_ref || null,
    });
    if (status === "Completed") {
      await PaymentLedger.record({
        reference_key: `refund:${refund.refund_id}:completed`,
        payment_id: refund.payment_id,
        refund_id: refund.refund_id,
        declaration_id: refund.declaration_id,
        entry_type: "REFUND_COMPLETED",
        debit_etb: Number(refund.amount || 0),
        currency: "ETB",
        description: "Approved refund paid back through gateway",
        created_by: req.user?.id || req.user?.email || null,
      });
    }
    await audit(req, {
      action: "refund_status_updated",
      entityType: "refund",
      entityId: refund.refund_id,
      reason: notes || null,
      after: { status, gateway_ref: gateway_ref || null, payment_id: refund.payment_id },
    });
    res.json(refund);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
