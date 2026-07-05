import fs from "fs";
import path from "path";
import { Document } from "../models/Document.js";
import { isImporterLike } from "../utils/roles.js";
import { resolveDocumentAbsPath } from "../utils/documentFiles.js";

export async function serveDocumentFile(req, res) {
  try {
    const doc = await Document.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (isImporterLike(req.user?.role) && doc.uploaded_by && String(doc.uploaded_by) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Access denied: document belongs to another user" });
    }

    const absPath = resolveDocumentAbsPath(doc);

    if (!absPath) {
      return res.status(404).json({ message: "Document file not found on server" });
    }

    return res.download(absPath, doc.file_name || path.basename(absPath));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
