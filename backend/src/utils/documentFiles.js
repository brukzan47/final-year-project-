import fs from "fs";
import path from "path";

export function resolveDocumentAbsPath(doc) {
  if (!doc) return null;

  const rawPath = String(doc.file_path || "").trim();
  const rawFileName = String(doc.file_name || "").trim();
  const normalizedRawPath = rawPath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalizedRawPath || rawFileName || rawPath) || path.win32.basename(rawPath) || rawFileName;
  const candidates = [];

  if (rawPath) {
    const cleaned = rawPath
      .replace(/^[a-zA-Z]:[\\/]/, "")
      .replace(/^[\\/]+/, "")
      .replace(/\\/g, path.sep);
    candidates.push(
      path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), cleaned),
      path.resolve(process.cwd(), cleaned),
    );
  }

  candidates.push(
    path.resolve(process.cwd(), "uploads", fileName),
    path.resolve(process.cwd(), "backend", "uploads", fileName),
    path.resolve(process.cwd(), "uploads", rawFileName || fileName),
    path.resolve(process.cwd(), "backend", "uploads", rawFileName || fileName),
  );

  return candidates.find((candidate) => {
    try {
      return candidate && fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) || null;
}
