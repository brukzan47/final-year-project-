import fs from "fs";
import path from "path";
import { Document } from "../models/Document.js";
import { pool } from "../config/db.js";
import { sha256FileSync } from "../utils/hashFile.js";
import { env } from "../config/env.js";
import { anchorHash } from "../services/anchorService.js";
import { notifyImporterByDeclaration } from "../services/notificationService.js";

export const getDocuments = async (req, res) => {
  try {
    const { declaration_id } = req.query;
    const docs = await Document.getAll({ declaration_id });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { declaration_id, shipment_id, title } = req.body;
    const file = req.file;
    const absPath = path.resolve(file.path);
    let file_hash = null;
    try {
      file_hash = sha256FileSync(absPath);
    } catch (_) { /* ignore hash errors */ }
    const payload = {
      declaration_id: declaration_id || null,
      shipment_id: shipment_id || null,
      title: title || null,
      file_name: file.originalname,
      file_path: `/uploads/${file.filename}`,
      file_type: file.mimetype,
      file_size: file.size,
      uploaded_by: req.user?.id || null,
      file_hash,
    };

    const created = await Document.create(payload);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const linkDocumentsToShipment = async (req, res) => {
  try {
    const { shipment_id, document_ids } = req.body || {};
    if (!shipment_id) return res.status(400).json({ message: "shipment_id is required" });
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ message: "document_ids is required" });
    }
    const rows = await Document.linkToShipment({ shipment_id, document_ids });
    return res.json({ ok: true, count: rows.length, documents: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Map field names to human-readable titles
const FIELD_TITLE_MAP = {
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading",
  airway_bill: "Airway Bill",
  certificate_of_origin: "Certificate of Origin",
  import_permit: "Import Permit",
  letter_of_credit: "Letter of Credit",
  insurance_certificate: "Insurance Certificate",
};

// Accept multiple named files and create Document rows for each
export const uploadBatch = async (req, res) => {
  try {
    const { declaration_id } = req.body || {};
    if (!declaration_id) {
      return res.status(400).json({ message: "declaration_id is required" });
    }
    const files = req.files || {};
    const created = [];
    const skipped = [];
    const existing = await Document.getAll({ declaration_id });
    const existingTitles = new Set(
      (existing || []).map((d) => String(d.title || "").trim().toLowerCase())
    );
  for (const field in files) {
      const arr = files[field] || [];
      for (const file of arr) {
        const title = FIELD_TITLE_MAP[field] || field;
        const key = String(title || "").trim().toLowerCase();
        if (existingTitles.has(key)) {
          skipped.push({ field, title, file_name: file.originalname, reason: "already_uploaded" });
          continue;
        }
        const absPath = path.resolve(file.path);
        let file_hash = null;
        try { file_hash = sha256FileSync(absPath); } catch (_) {}
        const payload = {
          declaration_id,
          title,
          file_name: file.originalname,
          file_path: `/uploads/${file.filename}`,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by: req.user?.id || null,
          file_hash,
        };
        const row = await Document.create(payload);
        created.push(row);
        existingTitles.add(key);
      }
    }
    if (created.length === 0 && skipped.length === 0) {
      return res.status(400).json({ message: "No files found in request" });
    }
    res.status(201).json({
      count: created.length,
      skipped_count: skipped.length,
      documents: created,
      skipped,
      message: skipped.length > 0
        ? "Some document types were already uploaded and were skipped."
        : "Documents uploaded successfully.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check required documents attached for a declaration
export const verifyRequired = async (req, res) => {
  try {
    const declaration_id = req.query.declaration_id;
    if (!declaration_id) {
      return res.status(400).json({ message: "declaration_id is required" });
    }

    // Fetch all docs for declaration
    const docs = await Document.getAll({ declaration_id });
    const titles = docs.map(d => (d.title || '').trim().toLowerCase());

    // Groups with alternatives
    const requirements = [
      { key: 'commercial_invoice', label: 'Commercial Invoice', anyOf: ['commercial invoice'] },
      { key: 'packing_list', label: 'Packing List', anyOf: ['packing list'] },
      { key: 'transport_doc', label: 'Bill of Lading / Airway Bill', anyOf: ['bill of lading', 'airway bill'] },
      { key: 'certificate_of_origin', label: 'Certificate of Origin', anyOf: ['certificate of origin'] },
      { key: 'permit_or_lc', label: 'Import Permit / Letter of Credit', anyOf: ['import permit', 'letter of credit'] },
      { key: 'insurance_certificate', label: 'Insurance Certificate', anyOf: ['insurance certificate'] },
    ];

    const missing = [];
    for (const reqItem of requirements) {
      const satisfied = reqItem.anyOf.some(a => titles.some(t => t.includes(a)));
      if (!satisfied) missing.push(reqItem.label);
    }

    res.json({
      ok: missing.length === 0,
      missing,
      attached: docs.length,
      required: requirements.map(r => r.label),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Attempt to remove the physical file if it exists
    try {
      const absPath = path.resolve(process.cwd(), `.${doc.file_path}`);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (_) {
      // Ignore unlink errors
    }

    await Document.delete(req.params.id);
    try {
      if (doc?.declaration_id) {
        await notifyImporterByDeclaration({
          declarationId: doc.declaration_id,
          title: { en: "Document Rejected", am: "ሰነድ ተሰርዟል" },
          message: {
            en: `${doc.title || "A document"} was rejected and removed. Please upload a corrected version.`,
            am: `${doc.title || "ሰነድ"} ተቀባይነት አላገኘም እና ተወግዷል። እባክዎ የተስተካከለ ስሪት ይላኩ።`,
          },
          category: "DOCUMENT",
          type: "ERROR",
          referenceId: doc.document_id,
          eventKey: `event:document_rejected:${doc.document_id}`,
        });
      }
    } catch {}
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Anchor a document's hash on blockchain (stub integration)
export const anchorDocument = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Document.getById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Ensure file hash exists (recompute if missing)
    let fileHash = doc.file_hash;
    if (!fileHash) {
      try {
        const absPath = path.resolve(process.cwd(), `.${doc.file_path}`);
        fileHash = sha256FileSync(absPath);
        await Document.updateFileHash(id, fileHash);
      } catch (_) { /* ignore */ }
    }

    // Anchor via service (real chain if configured, else stub)
    const result = await anchorHash(fileHash || "");
    const updated = await Document.setAnchored(id, {
      blockchain_hash: result.hashAnchored,
      blockchain_tx: result.txHash,
      blockchain_network: result.network || env.blockchain.networkName || String(env.blockchain.chainId || ''),
      status: "anchored",
    });
    res.json({ ok: true, document: updated, anchor: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Verify a document by recalculating local file hash and comparing
export const verifyDocumentHash = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Document.getById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const result = {
      document_id: doc.document_id,
      file_hash_db: doc.file_hash || null,
      blockchain_hash: doc.blockchain_hash || null,
      blockchain_status: doc.blockchain_status || null,
      matches_db: null,
      matches_blockchain: null,
      current_hash: null,
    };

    try {
      const absPath = path.resolve(process.cwd(), `.${doc.file_path}`);
      const cur = sha256FileSync(absPath);
      result.current_hash = cur;
      result.matches_db = !!doc.file_hash && cur === doc.file_hash;
      result.matches_blockchain = !!doc.blockchain_hash && cur === doc.blockchain_hash;
    } catch (e) {
      return res.status(500).json({ message: `Unable to hash file: ${e.message}` });
    }

    const authentic = (result.matches_db || result.matches_blockchain) === true;
    res.json({ ok: authentic, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
