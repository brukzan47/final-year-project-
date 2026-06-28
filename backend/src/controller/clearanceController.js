import { Clearance } from "../models/Clearance.js";
import { notifyImporterByDeclaration } from "../services/notificationService.js";
import { pool } from "../config/db.js";
import { audit } from "../utils/audit.js";

function norm(v) {
  return String(v || "").trim();
}

async function loadClearanceDetail(clearanceId) {
  const q = await pool.query(
    `SELECT c.*, d.declaration_no, d.declaration_date,
            s.shipment_reference, s.origin_country, s.destination_port,
            i.company_name
     FROM clearances c
     JOIN declarations d ON d.declaration_id = c.declaration_id
     JOIN shipments s ON s.shipment_id = d.shipment_id
     JOIN importers i ON i.importer_id = s.importer_id
     WHERE c.clearance_id = $1
     LIMIT 1`,
    [clearanceId]
  );
  return q.rows[0] || null;
}

export const getClearances = async (req, res) => {
  try {
    const data = await Clearance.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getClearanceById = async (req, res) => {
  try {
    const row = await loadClearanceDetail(req.params.id);
    if (!row) return res.status(404).json({ message: "Clearance not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getReleaseNote = async (req, res) => {
  try {
    const row = await loadClearanceDetail(req.params.id);
    if (!row) return res.status(404).json({ message: "Clearance not found" });

    let PDFDocument;
    let usePdf = false;
    try {
      const mod = await import("pdfkit");
      PDFDocument = mod.default || mod;
      usePdf = true;
    } catch {
      usePdf = false;
    }

    const fileBase = `release-note-${row.delivery_note_no || row.clearance_id}`;

    if (!usePdf) {
      const text = [
        "Customs Release Note",
        "--------------------",
        `Declaration No: ${row.declaration_no || "-"}`,
        `Declaration Date: ${row.declaration_date ? new Date(row.declaration_date).toISOString().slice(0, 10) : "-"}`,
        `Importer: ${row.company_name || "-"}`,
        `Shipment Ref: ${row.shipment_reference || "-"}`,
        `Origin Country: ${row.origin_country || "-"}`,
        `Destination Port: ${row.destination_port || "-"}`,
        `Release Date: ${row.release_date ? new Date(row.release_date).toISOString().slice(0, 10) : "-"}`,
        `Officer: ${row.officer_name || "-"}`,
        `Customs Office: ${row.customs_office || "-"}`,
        `Delivery Note No: ${row.delivery_note_no || "-"}`,
        `Transport Company: ${row.transport_company || "-"}`,
        `Truck Plate: ${row.truck_plate_no || "-"}`,
        `Destination Address: ${row.destination_address || "-"}`,
      ].join("\n");
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.txt"`);
      return res.send(text);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("Customs Release Note", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#444").text(`Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`);
    doc.moveDown(1);

    const rows = [
      ["Declaration No", row.declaration_no],
      ["Declaration Date", row.declaration_date ? new Date(row.declaration_date).toISOString().slice(0, 10) : "-"],
      ["Importer", row.company_name],
      ["Shipment Ref", row.shipment_reference],
      ["Origin Country", row.origin_country],
      ["Destination Port", row.destination_port],
      ["Release Date", row.release_date ? new Date(row.release_date).toISOString().slice(0, 10) : "-"],
      ["Officer", row.officer_name],
      ["Customs Office", row.customs_office],
      ["Delivery Note No", row.delivery_note_no],
      ["Transport Company", row.transport_company || "-"],
      ["Truck Plate", row.truck_plate_no || "-"],
      ["Destination Address", row.destination_address || "-"],
    ];

    doc.fillColor("#111").fontSize(11);
    for (const [k, v] of rows) {
      doc.font("Helvetica-Bold").text(`${k}: `, { continued: true });
      doc.font("Helvetica").text(String(v || "-"));
    }

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(10).fillColor("#444");
    doc.text("This document confirms customs release authorization for the above declaration.");
    doc.end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getReadinessQueue = async (req, res) => {
  try {
    const rows = (
      await pool.query(
        `
        SELECT d.declaration_id, d.declaration_no, d.declaration_date, d.status,
               s.shipment_reference, s.origin_country, s.cif_value_usd,
               i.company_name,
               EXISTS (
                 SELECT 1 FROM payments p
                 WHERE p.declaration_id = d.declaration_id
                   AND p.payment_status = 'Paid'
               ) AS payment_paid,
               EXISTS (
                 SELECT 1 FROM inspections ins
                 WHERE ins.declaration_id = d.declaration_id
                   AND ins.inspection_result = 'Passed'
               ) AS inspection_passed,
               EXISTS (
                 SELECT 1 FROM clearances c
                 WHERE c.declaration_id = d.declaration_id
               ) AS already_cleared
        FROM declarations d
        JOIN shipments s ON s.shipment_id = d.shipment_id
        JOIN importers i ON i.importer_id = s.importer_id
        ORDER BY d.declaration_date DESC
        LIMIT 500
        `
      )
    ).rows;

    const items = rows.map((r) => {
      const blockers = [];
      if (String(r.status || "").toLowerCase() === "rejected") blockers.push("Declaration is rejected");
      if (!r.payment_paid) blockers.push("Payment not marked as Paid");
      if (!r.inspection_passed) blockers.push("Inspection not passed");
      if (r.already_cleared) blockers.push("Already cleared");
      return {
        ...r,
        ready_for_clearance: blockers.length === 0,
        blockers,
      };
    });

    const ready = items.filter((x) => x.ready_for_clearance);
    const blocked = items.filter((x) => !x.ready_for_clearance);

    return res.json({ total: items.length, ready_count: ready.length, blocked_count: blocked.length, ready, blocked });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const createClearance = async (req, res) => {
  try {
    const declarationId = req.body?.declaration_id;
    if (!declarationId) return res.status(400).json({ message: "declaration_id is required" });

    const releaseDate = norm(req.body?.release_date);
    const officerName = norm(req.body?.officer_name);
    const customsOffice = norm(req.body?.customs_office);
    const deliveryNoteNo = norm(req.body?.delivery_note_no);

    if (!releaseDate) return res.status(400).json({ message: "release_date is required" });
    if (!officerName) return res.status(400).json({ message: "officer_name is required" });
    if (!customsOffice) return res.status(400).json({ message: "customs_office is required" });
    if (!deliveryNoteNo) return res.status(400).json({ message: "delivery_note_no is required" });

    const declarationQ = await pool.query(
      `SELECT declaration_id, declaration_date, status FROM declarations WHERE declaration_id = $1 LIMIT 1`,
      [declarationId]
    );
    if (declarationQ.rowCount === 0) return res.status(404).json({ message: "Declaration not found" });

    const decl = declarationQ.rows[0];
    if (String(decl.status || "").toLowerCase() === "rejected") {
      return res.status(403).json({ message: "Clearance blocked: declaration is Rejected" });
    }

    const already = await pool.query(
      `SELECT 1 FROM clearances WHERE declaration_id = $1 LIMIT 1`,
      [declarationId]
    );
    if (already.rowCount > 0) {
      return res.status(409).json({ message: "Clearance already exists for this declaration" });
    }

    const paid = await pool.query(
      `SELECT 1 FROM payments WHERE declaration_id=$1 AND payment_status='Paid' LIMIT 1`,
      [declarationId]
    );
    if (!paid.rowCount) {
      return res.status(403).json({ message: "Clearance blocked: declaration payment is not Paid" });
    }

    const inspected = await pool.query(
      `SELECT 1 FROM inspections WHERE declaration_id=$1 AND inspection_result='Passed' LIMIT 1`,
      [declarationId]
    );
    if (!inspected.rowCount) {
      return res.status(403).json({ message: "Clearance blocked: inspection result is not Passed" });
    }

    const clearData = {
      ...req.body,
      release_date: releaseDate,
      officer_name: officerName,
      customs_office: customsOffice,
      delivery_note_no: deliveryNoteNo,
    };

    const clearance = await Clearance.create(clearData);

    await pool.query(
      `UPDATE declarations SET status='Cleared', status_reason=NULL WHERE declaration_id=$1`,
      [declarationId]
    );
    await audit(req, {
      action: "clearance_created",
      entityType: "clearance",
      entityId: clearance.clearance_id,
      before: { declaration_status: decl.status },
      after: { declaration_id: declarationId, declaration_status: "Cleared", delivery_note_no: clearData.delivery_note_no },
    });

    try {
      await notifyImporterByDeclaration({
        declarationId,
        title: { en: "Clearance Approved", am: "ክሊራንስ ተፈቅዷል" },
        message: {
          en: `Goods cleared. Delivery note: ${clearData.delivery_note_no}.`,
          am: `እቃዎች ተፈትተዋል። የመልቀቂያ ወረቀት: ${clearData.delivery_note_no}.`,
        },
        category: "CLEARANCE",
        type: "SUCCESS",
        referenceId: clearance.clearance_id,
        eventKey: `event:clearance_approved:${clearance.clearance_id}`,
      });
    } catch {}

    res.status(201).json(clearance);
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Clearance already exists for this declaration" });
    }
    res.status(500).json({ message: err.message });
  }
};

