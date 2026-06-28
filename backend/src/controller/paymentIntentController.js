import { PaymentIntent } from "../models/PaymentIntent.js";
import { Payment } from "../models/Payment.js";
import { Document } from "../models/Document.js";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { sendMail } from "../utils/mailer.js";
import { pool } from "../config/db.js";
import { notifyImporterByDeclaration } from "../utils/notify.js";
import { hmacValid } from "../utils/webhookVerify.js";

function checkoutUrl(provider, intentId) {
  const p = String(provider || "").toUpperCase();
  if (p === "CHAPA") return `https://checkout.chapa.co/checkout/payment/${intentId}`;
  if (p === "TELEBIRR") return `https://telebirr.et/pay?intent_id=${encodeURIComponent(intentId)}`;
  if (p === "CBE") return `https://apps.cbe.com.et/payment?intent_id=${encodeURIComponent(intentId)}`;
  return null;
}

export const createIntent = async (req, res) => {
  try {
    const { declaration_id, amount_etb, provider, metadata } = req.body || {};
    if (!declaration_id || !amount_etb || !provider) {
      return res.status(400).json({ message: "declaration_id, amount_etb, provider are required" });
    }
    const intent = await PaymentIntent.create({ declaration_id, amount_etb, provider, metadata: metadata || null });
    res.status(201).json({
      ...intent,
      checkout_url: checkoutUrl(provider, intent.intent_id),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const initiateFromPayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const provider = String(req.body?.provider || "").toUpperCase();
    if (!["CBE", "TELEBIRR", "CHAPA"].includes(provider)) {
      return res.status(400).json({ message: "provider must be one of CBE, TELEBIRR, CHAPA" });
    }
    const payment = await Payment.getById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (String(payment.payment_status || "") !== "Pending") {
      return res.status(409).json({ message: "Payment can only be initiated while Pending" });
    }
    const intent = await PaymentIntent.create({
      declaration_id: payment.declaration_id,
      amount_etb: Number(payment.total_payable || 0),
      provider,
      metadata: { payment_id: paymentId },
    });
    await Payment.appendEvent(paymentId, "initiate", req.user?.id || req.user?.email || null, { provider, intent_id: intent.intent_id });
    return res.status(201).json({
      intent_id: intent.intent_id,
      provider,
      checkout_url: checkoutUrl(provider, intent.intent_id),
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const getIntent = async (req, res) => {
  try {
    const intent = await PaymentIntent.getById(req.params.id);
    if (!intent) return res.status(404).json({ message: "Not found" });
    res.json(intent);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

async function recordPaymentFromIntent(intent) {
  const payload = {
    declaration_id: intent.declaration_id,
    invoice_value_usd: null,
    exchange_rate: null,
    cif_etb: null,
    duty_paid: null,
    vat_paid: null,
    excise_paid: null,
    total_payable: intent.amount_etb,
    payment_method: `Online (${intent.provider})`,
    payment_status: "Verified",
    payment_date: new Date().toISOString().slice(0, 10),
    receipt_no: intent.receipt_no || null,
  };

  let createdPayment = null;
  try {
    const exists = await pool.query(
      "SELECT 1 FROM payments WHERE declaration_id=$1 AND payment_status IN ('Pending','Verified') LIMIT 1",
      [intent.declaration_id]
    );
    if (exists.rowCount === 0) {
      createdPayment = await Payment.create(payload);
    }
  } catch {}

  // Enterprise rule: receipt issuance is allowed only when payment reaches Paid.
  if (!createdPayment || String(createdPayment.payment_status) !== "Paid") return;

  // Generate a receipt (PDF when pdfkit is available, otherwise text)
  try {
    const receiptDir = path.join(process.cwd(), "uploads", "receipts");
    fs.mkdirSync(receiptDir, { recursive: true });

    let usePdf = false;
    let PDFDocument;
    try {
      const mod = await import('pdfkit');
      PDFDocument = mod.default || mod;
      usePdf = true;
    } catch {}

    const fileName = `receipt-${intent.intent_id}.${usePdf ? 'pdf' : 'txt'}`;
    const filePath = path.join(receiptDir, fileName);

    if (usePdf) {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      if (env.receipts.logoPath && fs.existsSync(env.receipts.logoPath)) {
        try { doc.image(env.receipts.logoPath, { fit: [120, 60], align: 'left' }); } catch {}
      }
      doc.fontSize(20).text('Payment Receipt', { align: 'right' });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
      doc.fontSize(12);
      const rows = [
        ['Receipt No', intent.receipt_no || 'N/A'],
        ['Intent ID', intent.intent_id],
        ['Declaration ID', intent.declaration_id],
        ['Provider', intent.provider],
        ['Provider Ref', intent.provider_ref || 'N/A'],
        ['Amount (ETB)', String(intent.amount_etb)],
        ['Date', new Date().toLocaleString()],
      ];
      rows.forEach(([k, v]) => {
        doc.font('Helvetica-Bold').text(`${k}: `, { continued: true });
        doc.font('Helvetica').text(String(v));
      });
      doc.moveDown();
      doc.text('This is a system-generated receipt linked to your customs declaration.');
      doc.end();
      await new Promise((resolve) => stream.on('finish', resolve));
    } else {
      const lines = [
        'Payment Receipt',
        '----------------',
        `Receipt No: ${intent.receipt_no || 'N/A'}`,
        `Intent ID: ${intent.intent_id}`,
        `Declaration ID: ${intent.declaration_id}`,
        `Provider: ${intent.provider}`,
        `Provider Ref: ${intent.provider_ref || 'N/A'}`,
        `Amount (ETB): ${String(intent.amount_etb)}`,
        `Date: ${new Date().toLocaleString()}`,
        '',
        'This is a system-generated receipt linked to your customs declaration.'
      ].join('\n');
      fs.writeFileSync(filePath, lines);
    }

    const stats = fs.statSync(filePath);
    await Document.create({
      declaration_id: intent.declaration_id,
      title: "Payment Receipt",
      file_name: fileName,
      file_path: `uploads/receipts/${fileName}`,
      file_type: usePdf ? 'application/pdf' : 'text/plain',
      file_size: stats.size,
      uploaded_by: null,
    });

    // Notifications and email to importer contact if available
    try {
      await notifyImporterByDeclaration({
        declaration_id: intent.declaration_id,
        title: { en: "Payment Confirmed", am: "ክፍያ ተረጋግጧል" },
        message: {
          en: `Payment of ETB ${String(intent.amount_etb)} via ${intent.provider} confirmed. Receipt: ${intent.receipt_no || 'N/A'}`,
          am: `የETB ${String(intent.amount_etb)} ክፍያ በ${intent.provider} ተረጋግጧል። ደረሰኝ: ${intent.receipt_no || 'N/A'}`,
        },
      });
    } catch {}

    try {
      const q = `
        SELECT i.contact_email
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE d.declaration_id=$1 LIMIT 1`;
      const r = await pool.query(q, [intent.declaration_id]);
      const to = r.rowCount ? r.rows[0].contact_email : null;
      if (to) {
        const subject = `Payment Receipt ${intent.receipt_no || ''}`.trim();
        const text = `Dear Customer,\n\nPlease find your payment receipt attached.\n\nDeclaration: ${intent.declaration_id}\nAmount (ETB): ${intent.amount_etb}\nProvider: ${intent.provider}\nReceipt No: ${intent.receipt_no || ''}\n\nRegards,\nEthiopian Customs`;
        await sendMail({
          to,
          subject,
          text,
          attachments: [{ filename: fileName, path: filePath, contentType: (usePdf ? 'application/pdf' : 'text/plain') }],
        });
      }
    } catch {}
  } catch {}
}

export const mockSucceed = async (req, res) => {
  try {
    const id = req.params.id;
    const receipt_no = req.body?.receipt_no || `REC-${Date.now()}`;
    const provider_ref = req.body?.provider_ref || `MOCK-${Math.floor(Math.random()*100000)}`;
    const intent = await PaymentIntent.setStatus(id, "succeeded", { provider_ref, receipt_no });
    if (!intent) return res.status(404).json({ message: "Not found" });
    await recordPaymentFromIntent(intent);
    res.json({ ok: true, intent });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const webhookCBE = async (req, res) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-cbe-signature'];
    if (!hmacValid({ body: req.body, secret: env.webhooks.cbeSecret, signature })) {
      return res.status(401).json({ message: 'invalid signature' });
    }
    const { intent_id, status, provider_ref, receipt_no } = req.body || {};
    if (!intent_id || !status) return res.status(400).json({ message: "invalid payload" });
    const updated = await PaymentIntent.setStatus(intent_id, status, { provider_ref, receipt_no });
    if (status === 'succeeded' && updated) await recordPaymentFromIntent(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const webhookAwash = async (req, res) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-awash-signature'];
    if (!hmacValid({ body: req.body, secret: env.webhooks.awashSecret, signature })) {
      return res.status(401).json({ message: 'invalid signature' });
    }
    const { intent_id, status, provider_ref, receipt_no } = req.body || {};
    if (!intent_id || !status) return res.status(400).json({ message: "invalid payload" });
    const updated = await PaymentIntent.setStatus(intent_id, status, { provider_ref, receipt_no });
    if (status === 'succeeded' && updated) await recordPaymentFromIntent(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
