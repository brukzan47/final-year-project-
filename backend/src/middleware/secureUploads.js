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

    const uploadRoot = path.resolve(process.cwd(), "uploads");
    const fileName = path.basename(String(doc.file_path || ""));
    const absPath = path.resolve(uploadRoot, fileName);
    if (!absPath.startsWith(uploadRoot + path.sep)) {
      return res.status(400).json({ message: "Invalid document path" });
    }

    return res.download(absPath, doc.file_name || fileName);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
