export const SYSTEM_ROLES = [
  "Super Admin",
  "Admin",
  "Customs Officer",
  "Inspector",
  "Clearance Officer",
  "Document Officer",
  "Risk Analyst",
  "Port Officer",
  "Finance Officer",
  "Auditor",
  "Importer",
];

export const ROLE_GROUPS = {
  all: SYSTEM_ROLES,
  admin: ["Super Admin", "Admin"],
  officer: ["Super Admin", "Admin", "Customs Officer"],
  operations: ["Super Admin", "Admin", "Customs Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer"],
  declarations: ["Super Admin", "Admin"],
  declarationEntry: ["Super Admin", "Admin", "Customs Officer", "Importer"],
  declarationReview: ["Super Admin", "Admin"],
  inspections: ["Super Admin", "Admin", "Customs Officer", "Inspector"],
  clearance: ["Super Admin", "Admin", "Customs Officer", "Clearance Officer"],
  documents: ["Super Admin", "Admin", "Customs Officer", "Document Officer", "Importer"],
  finance: ["Finance Officer"],
  payments: ["Super Admin", "Admin", "Finance Officer", "Importer"],
  analytics: ["Super Admin", "Admin", "Customs Officer", "Risk Analyst", "Auditor"],
  tracking: ["Super Admin", "Admin", "Customs Officer", "Port Officer", "Importer"],
  users: ["Super Admin", "Admin"],
  reports: ["Super Admin", "Admin", "Customs Officer", "Risk Analyst", "Auditor", "Finance Officer"],
  notifications: ["Super Admin", "Admin", "Document Officer", "Inspector", "Clearance Officer", "Risk Analyst", "Port Officer", "Finance Officer"],
};

export function normalizeRoleName(value) {
  return String(value || "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

export function canonicalRoleName(value) {
  const normalized = normalizeRoleName(value);
  return SYSTEM_ROLES.find((role) => normalizeRoleName(role) === normalized) || String(value || "").trim();
}

export function hasRoleAccess(role, allowed = []) {
  if (!allowed?.length) return true;
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === "super admin") return true;
  return allowed.some((item) => normalizeRoleName(item) === normalizedRole);
}
