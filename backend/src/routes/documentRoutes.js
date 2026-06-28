import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { upload } from "../utils/fileUpload.js";
import {
  getDocuments,
  uploadDocument,
  getDocumentById,
  deleteDocument,
  uploadBatch,
  linkDocumentsToShipment,
  verifyRequired,
  anchorDocument,
  verifyDocumentHash,
} from "../controller/documentController.js";
import { serveDocumentFile } from "../middleware/secureUploads.js";

const router = express.Router();

// List documents (optionally filter by declaration_id)
router.get(
  "/",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  getDocuments
);

// Verify mandatory documents for a declaration
router.get(
  "/verify",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  verifyRequired
);

// Upload a document (multipart/form-data: file, declaration_id, title)
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  upload.single("file"),
  uploadDocument
);

// Batch upload of supporting documents (multiple named fields)
router.post(
  "/batch",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  upload.fields([
    { name: "commercial_invoice", maxCount: 1 },
    { name: "packing_list", maxCount: 1 },
    { name: "bill_of_lading", maxCount: 1 },
    { name: "airway_bill", maxCount: 1 },
    { name: "certificate_of_origin", maxCount: 1 },
    { name: "import_permit", maxCount: 1 },
    { name: "letter_of_credit", maxCount: 1 },
    { name: "insurance_certificate", maxCount: 1 },
  ]),
  uploadBatch
);

// Link already-uploaded documents to a shipment (used by shipment wizard)
router.post(
  "/link-shipment",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  linkDocumentsToShipment
);

// Authenticated file download. Raw uploads are not exposed as public static files.
router.get(
  "/:id/file",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  serveDocumentFile
);

// Get single document metadata
router.get(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  getDocumentById
);

// Delete a document
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer"),
  deleteDocument
);

// Anchor document hash on blockchain (stubbed integration)
router.post(
  "/:id/anchor",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Importer"),
  anchorDocument
);

// Verify a document's integrity by recomputing hash and comparing
router.get(
  "/:id/verify-hash",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer"),
  verifyDocumentHash
);

export default router;

