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
  declarations: ["Super Admin", "Admin", "Customs Officer"],
  inspections: ["Super Admin", "Admin", "Customs Officer", "Inspector"],
  clearance: ["Super Admin", "Admin", "Customs Officer", "Clearance Officer"],
  documents: ["Super Admin", "Admin", "Customs Officer", "Document Officer", "Importer"],
  finance: ["Finance Officer"],
  payments: ["Super Admin", "Admin", "Finance Officer", "Importer"],
  analytics: ["Super Admin", "Admin", "Customs Officer", "Risk Analyst", "Auditor"],
  tracking: ["Super Admin", "Admin", "Customs Officer", "Port Officer", "Importer"],
  users: ["Super Admin", "Admin", "Customs Officer"],
  reports: ["Super Admin", "Admin", "Customs Officer", "Risk Analyst", "Auditor", "Finance Officer"],
  notifications: ["Super Admin", "Admin", "Customs Officer", "Document Officer", "Inspector", "Clearance Officer", "Risk Analyst", "Port Officer", "Finance Officer"],
};

export function hasRoleAccess(role, allowed = []) {
  if (!allowed?.length) return true;
  if (role === "Super Admin") return true;
  return allowed.includes(role);
}
