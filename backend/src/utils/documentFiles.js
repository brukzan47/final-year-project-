import fs from "fs";
import path from "path";

export function resolveDocumentAbsPath(doc) {
  if (!doc) return null;

  const rawPath = String(doc.file_path || "").trim();
  const fileName = path.basename(rawPath || String(doc.file_name || ""));
  const candidates = [];

  if (rawPath) {
    const cleaned = rawPath.replace(/^\/*/, "");
    candidates.push(
      path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), cleaned),
      path.resolve(process.cwd(), cleaned),
    );
  }

  candidates.push(
    path.resolve(process.cwd(), "uploads", fileName),
    path.resolve(process.cwd(), "backend", "uploads", fileName),
    path.resolve(process.cwd(), "uploads", String(doc.file_name || fileName)),
    path.resolve(process.cwd(), "backend", "uploads", String(doc.file_name || fileName)),
  );

  return candidates.find((candidate) => {
    try {
      return candidate && fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) || null;
}

