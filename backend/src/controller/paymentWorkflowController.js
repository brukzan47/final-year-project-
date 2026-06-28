import crypto from "crypto";
import { Payment } from "../models/Payment.js";
import { PaymentLedger } from "../models/PaymentLedger.js";
import { Declaration } from "../models/Declaration.js";
import { notifyImporterByDeclaration, notifyRoleGroup } from "../services/notificationService.js";
import { Status, assertTransition, verifyAcceptance } from "../services/paymentState.js";
import { env } from "../config/env.js";
import { pool } from "../config/db.js";

export const reverify = async (req, res) => {
  try {
    const id = req.params.id;
    const payment = await Payment.getById(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const current = payment.payment_status || Status.Pending;
    if (current !== Status.Failed) {
      return res.status(409).json({ message: `Can only reset failed payment. Current: ${current}` });
    }
    const done = await Payment.updateFields(id, { payment_status: Status.Pending, failure_reason: null });
    await Payment.appendEvent(id, "reverify_reset", req.user?.id || null, { from: current, to: Status.Pending });
    return res.status(200).json(done);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const verify = async (req, res) => {
  try {
    const id = req.params.id;
    const { receipt_no, paid_amount, currency } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const q = await client.query("SELECT * FROM payments WHERE payment_id=$1 FOR UPDATE", [id]);
      if (!q.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Payment not found" });
      }
      const payment = q.rows[0];
      if ((payment.payment_status || Status.Pending) !== Status.Pending) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: `Must be ${Status.Pending} to verify` });
      }

      const updated = await client.query(
        `UPDATE payments
            SET payment_status=$1,
                verified_by=$2,
                verified_at=$3,
                receipt_no=COALESCE($4, receipt_no),
                paid_amount=COALESCE($5, paid_amount),
                currency=COALESCE($6, currency),
                failure_reason=NULL,
                updated_at=now()
          WHERE payment_id=$7
          RETURNING *`,
        [
          Status.Verified,
          req.user?.id || null,
          new Date(),
          receipt_no || null,
          paid_amount ?? null,
          currency || null,
          id,
        ]
      );
      await Payment.appendEvent(id, "verify", req.user?.id || null, { from: Status.Pending, to: Status.Verified }, client);
      await client.query("COMMIT");
      return res.status(200).json(updated.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const reject = async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body || {};
    const payment = await Payment.getById(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const current = payment.payment_status || Status.Pending;
    if (current !== Status.Pending) {
      return res.status(409).json({ message: `Must be ${Status.Pending} to reject` });
    }
    try { assertTransition(current, Status.Failed); } catch (err) {
      return res.status(409).json({ message: err.message });
    }
    const done = await Payment.updateFields(id, {
      payment_status: Status.Failed,
      failure_reason: reason || "MANUAL_REJECT",
      verified_by: req.user?.id || null,
      verified_at: new Date(),
    });
    await Payment.appendEvent(id, "reject", req.user?.id || null, { from: current, to: Status.Failed, reason: reason || "MANUAL_REJECT" });
    return res.status(200).json(done);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const approve = async (req, res) => {
  try {
    const id = req.params.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const q = await client.query("SELECT * FROM payments WHERE payment_id=$1 FOR UPDATE", [id]);
      if (!q.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Payment not found" });
      }
      const payment = q.rows[0];
      if ((payment.payment_status || Status.Pending) !== Status.Verified) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: `Must be ${Status.Verified} to approve` });
      }
      const now = new Date();
      const updated = await client.query(
        `UPDATE payments
            SET payment_status=$1,
                approved_by=$2,
                approved_at=$3,
                paid=TRUE,
                payment_date=COALESCE(payment_date, $4),
                paid_amount=COALESCE(paid_amount, total_payable),
                updated_at=now()
          WHERE payment_id=$5
            AND payment_status=$6
          RETURNING *`,
        [Status.Paid, req.user?.id || null, now, now, id, Status.Verified]
      );
      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Must be Verified to approve" });
      }
      const paidRow = updated.rows[0];
      await PaymentLedger.record({
        reference_key: `payment:${paidRow.payment_id}:paid`,
        payment_id: paidRow.payment_id,
        declaration_id: paidRow.declaration_id,
        entry_type: "PAYMENT_PAID",
        credit_etb: Number(paidRow.paid_amount || paidRow.total_payable || 0),
        currency: paidRow.currency || "ETB",
        description: "Customs duty/tax payment collected",
        created_by: req.user?.id || null,
      }, client);
      await Payment.appendEvent(id, "approve", req.user?.id || null, { from: Status.Verified, to: Status.Paid }, client);
      await client.query("COMMIT");
      const done = updated.rows[0];

      if (done?.declaration_id) {
        try {
          await Declaration.setStatus({ id: done.declaration_id, status: "Paid", reason: null });
          await notifyImporterByDeclaration({
            declarationId: done.declaration_id,
            title: { en: "Payment Confirmed", am: "ክፍያ ተረጋግጧል" },
            message: {
              en: `Payment approved and marked Paid. Receipt ${done.receipt_no || "N/A"}.`,
              am: `ክፍያው ጸድቆ Paid ሆኗል። ደረሰኝ ${done.receipt_no || "N/A"}.`,
            },
            category: "PAYMENT",
            type: "SUCCESS",
            referenceId: done.payment_id,
            eventKey: `event:payment_confirmed:${done.payment_id}`,
          });
          await notifyRoleGroup({
            roles: ["Customs Officer"],
            title: { en: "Payment Confirmed", am: "ክፍያ ተረጋግጧል" },
            message: {
              en: `Declaration payment confirmed for ${done.declaration_id}.`,
              am: `የመግለጫ ${done.declaration_id} ክፍያ ተረጋግጧል።`,
            },
            category: "PAYMENT",
            type: "SUCCESS",
            referenceId: done.payment_id,
            eventKeyPrefix: `event:payment_confirmed_officer:${done.payment_id}`,
          });
          await notifyImporterByDeclaration({
            declarationId: done.declaration_id,
            title: { en: "Receipt Available", am: "ደረሰኝ ዝግጁ ነው" },
            message: {
              en: "Your payment receipt is now available for download.",
              am: "የክፍያ ደረሰኝዎ አሁን ለማውረድ ዝግጁ ነው።",
            },
            category: "PAYMENT",
            type: "SUCCESS",
            referenceId: done.payment_id,
            eventKey: `event:receipt_available:${done.payment_id}`,
          });
        } catch {}
      }
      return res.status(200).json(done);
    } catch (err) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function constantTimeEqual(a, b) {
  try {
    const ba = Buffer.from(a || "", "hex");
    const bb = Buffer.from(b || "", "hex");
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}

export const bankWebhook = async (req, res) => {
  try {
    const raw = req.body; // Buffer from express.raw
    const sig = req.header("X-Signature") || req.header("x-signature");
    const secret = (env.webhooks.cbeSecret || env.webhooks.awashSecret || "").trim();
    if (!secret) return res.status(400).send("No secret configured");
    const mac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (!constantTimeEqual(mac, sig)) return res.status(400).send("Bad signature");

    const event = JSON.parse(raw.toString("utf8"));
    const {
      payment_order_no,
      transaction_id,
      receipt_no,
      paid_amount,
      currency,
      bank_name,
      paid_at,
    } = event || {};
    if (!payment_order_no) return res.status(400).send("payment_order_no required");
    const provider = String(bank_name || "bank");
    try {
      await pool.query(
        `INSERT INTO payment_callbacks (provider, external_txn_id, payment_order_no, raw_payload, signature_valid, processed)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (provider, external_txn_id) DO NOTHING`,
        [provider, transaction_id || null, payment_order_no, event, true, false]
      );
    } catch {}

    const payment = await Payment.findByPaymentOrderNo(payment_order_no);
    if (!payment) return res.status(202).end(); // accept but nothing to match
    const current = payment.payment_status || Status.Pending;
    if (current !== Status.Pending) {
      return res.status(202).json({ payment_id: payment.payment_id, status: current });
    }

    const result = verifyAcceptance(
      payment,
      { paid_amount, currency, receipt_no },
      { allowFx: false, minAmountRatio: 1.0 }
    );
    const next = result.ok ? Status.Verified : Status.Failed;
    try { assertTransition(current, next); } catch {}
    const updated = await Payment.updateFields(payment.payment_id, {
      payment_status: next,
      verified_by: null,
      verified_at: new Date(),
      transaction_id: transaction_id || null,
      receipt_no: receipt_no || null,
      paid_amount: paid_amount ?? null,
      currency: currency || payment.currency || null,
      bank_name: bank_name || null,
      payment_date: paid_at ? new Date(paid_at) : payment.payment_date || new Date(),
      failure_reason: result.ok ? null : (result.reason || "NO_MATCH"),
    });
    await Payment.appendEvent(
      payment.payment_id,
      "bank_webhook",
      null,
      { bank_name, transaction_id, result: next, payment_order_no }
    );
    try {
      await pool.query(
        `UPDATE payment_callbacks
            SET processed=TRUE
          WHERE provider=$1
            AND COALESCE(external_txn_id,'')=COALESCE($2,'')
            AND payment_order_no=$3`,
        [provider, transaction_id || null, payment_order_no]
      );
    } catch {}
    return res.status(202).json({ payment_id: updated.payment_id, status: updated.payment_status });
  } catch (err) {
    return res.status(500).send(err.message);
  }
};
