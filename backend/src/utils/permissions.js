import { normalizeRoleName } from "./roles.js";

export const PERMISSIONS = Object.freeze({
  VIEW_PAYMENTS: ["Super Admin", "Admin", "Finance Officer", "Importer", "Auditor"],
  VERIFY_PAYMENTS: ["Super Admin", "Admin", "Finance Officer"],
  REJECT_PAYMENTS: ["Super Admin", "Admin", "Finance Officer"],
  APPROVE_REFUNDS: ["Super Admin", "Admin", "Finance Officer"],
  VIEW_REVENUE_REPORTS: ["Super Admin", "Admin", "Finance Officer", "Auditor"],
  GENERATE_RECEIPTS: ["Super Admin", "Admin", "Finance Officer", "Importer"],
  MANAGE_USERS: ["Super Admin", "Admin"],
  CHANGE_TARIFF_RATES: ["Super Admin", "Admin"],
  FINAL_CLEARANCE: ["Super Admin", "Admin", "Customs Officer", "Clearance Officer"],
  MODIFY_DECLARATIONS: ["Super Admin", "Admin", "Customs Officer", "Importer"],
});

export function rolesForPermission(permission) {
  return PERMISSIONS[permission] || [];
}

export function hasPermission(role, permission) {
  const normalized = normalizeRoleName(role);
  return rolesForPermission(permission).map(normalizeRoleName).includes(normalized);
}
