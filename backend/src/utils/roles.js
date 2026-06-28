export function normalizeRoleName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isImporterLike(value) {
  return normalizeRoleName(value) === "importer";
}
