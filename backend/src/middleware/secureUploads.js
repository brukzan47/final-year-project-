import fs from "fs";
import path from "path";
import { Document } from "../models/Document.js";
import { isImporterLike } from "../utils/roles.js";

export async function serveDocumentFile(req, res) {
  try {
    const doc = await Document.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (isImporterLike(req.user?.role) && doc.uploaded_by && String(doc.uploaded_by) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Access denied: document belongs to another user" });
    }

    const rawPath = String(doc.file_path || "").trim();
    const fileName = path.basename(rawPath || String(doc.file_name || ""));
    const candidates = [];

    if (rawPath) {
      candidates.push(
        path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath.replace(/^\//, "")),
        path.resolve(process.cwd(), rawPath.replace(/^\//, "")),
      );
    }
    candidates.push(
      path.resolve(process.cwd(), "uploads", fileName),
      path.resolve(process.cwd(), "backend", "uploads", fileName),
      path.resolve(process.cwd(), "uploads", String(doc.file_name || fileName)),
      path.resolve(process.cwd(), "backend", "uploads", String(doc.file_name || fileName)),
    );

    const absPath = candidates.find((candidate) => {
      try {
        return candidate && fs.existsSync(candidate);
      } catch {
        return false;
      }
    });

    if (!absPath) {
      return res.status(404).json({ message: "Document file not found on server" });
    }

    return res.download(absPath, doc.file_name || fileName);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
