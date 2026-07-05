import fs from "fs";
import path from "path";
import { sha256FileSync } from "./hashFile.js";

function listFilesRecursive(dir, out = []) {
  try {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isFile()) out.push(abs);
      else if (entry.isDirectory()) listFilesRecursive(abs, out);
    }
  } catch {}
  return out;
}

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
    const uploadsTail = normalizedRawPath.match(/(?:^|\/)(?:backend\/)?uploads\/(.+)$/i)?.[1] || "";
    const uploadsBase = uploadsTail ? path.posix.basename(uploadsTail) : "";
    candidates.push(
      path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), cleaned),
      path.resolve(process.cwd(), cleaned),
    );
    if (uploadsBase) {
      candidates.push(
        path.resolve(process.cwd(), "uploads", uploadsBase),
        path.resolve(process.cwd(), "backend", "uploads", uploadsBase),
      );
    }
  }

  candidates.push(
    path.resolve(process.cwd(), "uploads", fileName),
    path.resolve(process.cwd(), "backend", "uploads", fileName),
    path.resolve(process.cwd(), "uploads", rawFileName || fileName),
    path.resolve(process.cwd(), "backend", "uploads", rawFileName || fileName),
  );

  const found = candidates.find((candidate) => {
    try {
      return candidate && fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (found) return found;

  const searchDirs = [
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "backend", "uploads"),
  ];
  const targetNames = new Set(
    [fileName, rawFileName, path.posix.basename(normalizedRawPath || ""), path.win32.basename(rawPath || "")]
      .filter(Boolean)
      .map((name) => String(name).toLowerCase())
  );
  for (const dir of searchDirs) {
    try {
      const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
      const match = entries.find((entry) => entry.isFile() && targetNames.has(entry.name.toLowerCase()));
      if (match) return path.join(dir, match.name);
    } catch {}
  }

  const fileHash = String(doc.file_hash || "").trim().toLowerCase();
  if (fileHash) {
    for (const dir of searchDirs) {
      const files = listFilesRecursive(dir);
      for (const abs of files) {
        try {
          if (sha256FileSync(abs).toLowerCase() === fileHash) return abs;
        } catch {}
      }
    }
  }

  return null;
}
