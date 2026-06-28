import { Payment } from "../models/Payment.js";
import { PaymentLedger } from "../models/PaymentLedger.js";
import { Document } from "../models/Document.js";
import path from "path";
import fs from "fs";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { CustomsCalculator as Calc } from "../utils/calculator.js";
import { notifyImporterByDeclaration } from "../services/notificationService.js";
import { isImporterLike } from "../utils/roles.js";

export const getPayments = async (req, res) => {
  try {
    // Importers only see their own payments
    if (isImporterLike(req.user?.role) && req.user?.email) {
      const q = await pool.query(
        `SELECT p.*, d.declaration_no
         FROM payments p
         JOIN declarations d ON p.declaration_id = d.declaration_id
         JOIN shipments s ON d.shipment_id = s.shipment_id
         JOIN importers i ON s.importer_id = i.importer_id
         WHERE i.contact_email = $1
         ORDER BY COALESCE(p.payment_date, d.declaration_date) DESC NULLS LAST, p.created_at DESC NULLS LAST;`,
        [req.user.email]
      );
      return res.json(q.rows);
    }

    const data = await Payment.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const item = await Payment.getById(req.params.id);
    if (!item) return res.status(404).json({ message: "Payment not found" });

    if (isImporterLike(req.user?.role)) {
      const own = await pool.query(
        `SELECT 1
           FROM declarations d
           JOIN shipments s ON d.shipment_id = s.shipment_id
           JOIN importers i ON s.importer_id = i.importer_id
          WHERE d.declaration_id=$1 AND i.contact_email=$2
          LIMIT 1`,
        [item.declaration_id, req.user?.email || null]
      );
      if (own.rowCount === 0) return res.status(403).json({ message: "Not allowed for this payment" });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getPaymentsSummary = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE payment_status = 'Pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE payment_status = 'Verified')::int AS verified_count,
        COUNT(*) FILTER (WHERE payment_status = 'Paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE payment_status = 'Failed')::int AS failed_count,
        COALESCE(SUM(total_payable), 0) AS assessed_amount,
        COALESCE(SUM(total_payable) FILTER (WHERE payment_status = 'Paid'), 0) AS total_revenue,
        COALESCE(SUM(total_payable) FILTER (WHERE payment_status = 'Pending'), 0) AS pending_amount,
        COALESCE(SUM(total_payable) FILTER (WHERE payment_status = 'Verified'), 0) AS verified_amount,
        COALESCE(SUM(total_payable) FILTER (WHERE payment_status = 'Failed'), 0) AS failed_amount,
        COALESCE(SUM(total_payable) FILTER (WHERE payment_status IN ('Pending', 'Verified')), 0) AS outstanding_amount
      FROM payments
    `);
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentAuditLogs = async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT
          e.event_id,
          e.payment_id,
          e.event_type,
          e.actor,
          e.payload,
          e.created_at,
          p.declaration_id,
          p.payment_status,
          p.total_payable,
          p.payment_method,
          p.receipt_no,
          d.declaration_no
         FROM payment_events e
         JOIN payments p ON e.payment_id = p.payment_id
         LEFT JOIN declarations d ON p.declaration_id = d.declaration_id
        ORDER BY e.created_at DESC
        LIMIT 250`
    );
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentLedger = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 200);
    return res.json(await PaymentLedger.list({ limit }));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getPaymentAccountingLedger = async (req, res) => {
  try {
    return res.json(await PaymentLedger.accounting());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const createPayment = async (req, res) => {
  try {
    const body = { ...req.body };
    const usd = Number(body.invoice_value_usd);
    const rate = Number(body.exchange_rate);

    if (!body.declaration_id) return res.status(400).json({ message: "declaration_id is required" });
    body.payment_status = "Pending";
    body.receipt_no = null;

    // Generate payment order no if missing
    if (!body.payment_order_no) {
      const y = new Date().getFullYear();
      const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
      body.payment_order_no = `PO-${y}-${rand}`;
    }

    // Compute CIF ETB if possible
    if (isFinite(usd) && isFinite(rate)) {
      body.cif_etb = Math.round(Calc.cifToETB(usd, rate) * 100) / 100;
    } else if (body.cif_etb !== null && body.cif_etb !== undefined && !isFinite(Number(body.cif_etb))) {
      body.cif_etb = null;
    }

    // Attempt to compute duty, VAT, and total based on declaration tariff_rate
    try {
      if (body.declaration_id && isFinite(Number(body.cif_etb))) {
        const q = await pool.query("SELECT tariff_rate FROM declarations WHERE declaration_id=$1", [body.declaration_id]);
        const tariff = q.rowCount ? Number(q.rows[0].tariff_rate) : NaN;
        if (isFinite(tariff)) {
          const duty = Calc.calculateDuty(body.cif_etb, tariff);
          const vat = Calc.calculateVAT(body.cif_etb, duty);
          const excise = isFinite(Number(body.excise_paid)) ? Number(body.excise_paid) : 0;
          const total = Calc.totalPayable(body.cif_etb, duty, vat, excise);
          const r2 = (n) => Math.round(n * 100) / 100;
          body.duty_paid = r2(duty);
          body.vat_paid = r2(vat);
          body.total_payable = r2(total);
        }
      }
    } catch {}
    // Guard: one active payment per declaration
    const exists = await pool.query(
      "SELECT 1 FROM payments WHERE declaration_id=$1 AND payment_status IN ('Pending','Verified') LIMIT 1",
      [body.declaration_id]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Declaration already has an active payment" });
    }

    const payment = await Payment.create(body);
    try {
      await notifyImporterByDeclaration({
        declarationId: body.declaration_id,
        title: { en: "Payment Required", am: "ክፍያ ያስፈልጋል" },
        message: {
          en: `Your declaration requires payment. Order: ${payment.payment_order_no || "N/A"}.`,
          am: `ለመግለጫዎ ክፍያ ያስፈልጋል። ትዕዛዝ: ${payment.payment_order_no || "N/A"}.`,
        },
        category: "PAYMENT",
        type: "WARNING",
        referenceId: payment.payment_id,
        eventKey: `event:payment_required:${payment.payment_id}`,
      });
    } catch {}
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentReceipt = async (req, res) => {
  try {
    const id = req.params.id;
    const q = await pool.query(
      `SELECT declaration_id, payment_status FROM payments WHERE payment_id=$1 LIMIT 1`,
      [id]
    );
    if (q.rowCount === 0) return res.status(404).json({ message: 'Payment not found' });
    const declaration_id = q.rows[0].declaration_id;
    const payment_status = String(q.rows[0].payment_status || "");
    if (payment_status !== "Paid") {
      return res.status(403).json({ message: "Receipt available only after payment is approved (Paid)" });
    }

    // Importers can only access their own receipts
    if (isImporterLike(req.user?.role)) {
      const own = await pool.query(
        `SELECT 1
           FROM declarations d
           JOIN shipments s ON d.shipment_id = s.shipment_id
           JOIN importers i ON s.importer_id = i.importer_id
          WHERE d.declaration_id=$1 AND i.contact_email=$2
          LIMIT 1`,
        [declaration_id, req.user?.email || null]
      );
      if (own.rowCount === 0) return res.status(403).json({ message: 'Not allowed for this receipt' });
    }
    const docs = await Document.getAll({ declaration_id });
    const doc = (docs || []).find(d => String(d.title || '').toLowerCase().includes('receipt'));
    if (doc) {
      const abs = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path);
      if (fs.existsSync(abs)) {
        res.setHeader('Content-Type', doc.file_type || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name || 'receipt.pdf'}"`);
        return fs.createReadStream(abs).pipe(res);
      }
    }
    // Fallback: generate a receipt on the fly
    const pr = await pool.query(
      `SELECT p.payment_id, p.declaration_id, p.total_payable, p.payment_method, p.payment_status, p.receipt_no, p.payment_date, d.declaration_no
       FROM payments p JOIN declarations d ON p.declaration_id = d.declaration_id
       WHERE p.payment_id = $1 LIMIT 1`,
      [id]
    );
    if (pr.rowCount === 0) return res.status(404).json({ message: 'Payment not found' });
    const rec = pr.rows[0];
    let usePdf = false; let PDFDocument;
    try {
      const mod = await import('pdfkit');
      PDFDocument = mod.default || mod;
      usePdf = true;
    } catch {}
    const fileName = `payment-receipt-${rec.payment_id}.${usePdf ? 'pdf' : 'txt'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    if (usePdf) {
      res.setHeader('Content-Type', 'application/pdf');
      const pdoc = new PDFDocument({ size: 'A4', margin: 50 });
      pdoc.pipe(res);
      try {
        if (env.receipts.logoPath && fs.existsSync(env.receipts.logoPath)) {
          pdoc.image(env.receipts.logoPath, { fit: [120, 60], align: 'left' });
        }
      } catch {}
      pdoc.fontSize(20).text('Payment Receipt', { align: 'right' });
      pdoc.moveDown(1);
      pdoc.moveTo(50, pdoc.y).lineTo(545, pdoc.y).strokeColor('#cccccc').stroke();
      pdoc.moveDown(0.5);
      pdoc.fontSize(12);
      const rows = [
        ['Receipt No', rec.receipt_no || 'N/A'],
        ['Payment ID', rec.payment_id],
        ['Declaration No', rec.declaration_no],
        ['Status', rec.payment_status || 'N/A'],
        ['Method', rec.payment_method || 'N/A'],
        ['Amount (ETB)', String(rec.total_payable ?? '-')],
        ['Payment Date', rec.payment_date ? new Date(rec.payment_date).toLocaleString() : 'N/A'],
      ];
      rows.forEach(([k, v]) => {
        pdoc.font('Helvetica-Bold').text(`${k}: `, { continued: true });
        pdoc.font('Helvetica').text(String(v));
      });
      pdoc.moveDown();
      pdoc.text('This is a system-generated receipt linked to your customs declaration.');
      pdoc.end();
    } else {
      res.setHeader('Content-Type', 'text/plain');
      const lines = [
        'Payment Receipt',
        '----------------',
        `Receipt No: ${rec.receipt_no || 'N/A'}`,
        `Payment ID: ${rec.payment_id}`,
        `Declaration No: ${rec.declaration_no}`,
        `Status: ${rec.payment_status || 'N/A'}`,
        `Method: ${rec.payment_method || 'N/A'}`,
        `Amount (ETB): ${String(rec.total_payable ?? '-')}`,
        `Payment Date: ${rec.payment_date ? new Date(rec.payment_date).toLocaleString() : 'N/A'}`,
        '',
        'This is a system-generated receipt linked to your customs declaration.'
      ].join('\n');
      res.send(lines);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
