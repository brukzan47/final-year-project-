import { ROLE_GROUPS } from "../utils/roleAccess.js";

export const navItems = [
  { to: "/importers", labelKey: "economicOperators", roles: ["Super Admin", "Admin", "Customs Officer", "Importer"] },
  { to: "/shipments", labelKey: "shipmentDesk", roles: ROLE_GROUPS.tracking },
  { to: "/declarations", labelKey: "declarationDesk", roles: ROLE_GROUPS.declarations },
  { to: "/declarations-admin", labelKey: "declarationAdmin", roles: ROLE_GROUPS.declarations },
  { to: "/inspections", labelKey: "inspectionDesk", roles: ROLE_GROUPS.inspections },
  { to: "/finance", labelKey: "financeWorkspace", roles: ROLE_GROUPS.finance },
  { to: "/payments", labelKey: "paymentBoard", roles: ROLE_GROUPS.payments },
  { to: "/devices", labelKey: "deviceRegistry", roles: ["Super Admin", "Admin", "Customs Officer", "Port Officer"] },
  { to: "/locations", labelKey: "locations", roles: ["Super Admin", "Admin", "Port Officer"] },
  { to: "/search", labelKey: "search", roles: ["Super Admin", "Admin", "Importer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor"] },
  { to: "/single-window", labelKey: "singleWindow", roles: ["Super Admin", "Admin", "Customs Officer", "Document Officer", "Port Officer"] },
  { to: "/smart-analytics", labelKey: "smartAnalytics", roles: ROLE_GROUPS.analytics },
  { to: "/data-health", labelKey: "dataHealth", roles: ROLE_GROUPS.admin },
  { to: "/my-tracking", labelKey: "myTracking", roles: ["Importer"] },
  { to: "/clearance", labelKey: "clearanceControl", roles: ROLE_GROUPS.clearance },
  { to: "/performance", labelKey: "performance", roles: ROLE_GROUPS.operations },
  { to: "/users", labelKey: "users", roles: ROLE_GROUPS.users },
  { to: "/notifications-admin", labelKey: "notificationsAdmin", roles: ROLE_GROUPS.notifications },
  { to: "/reports", labelKey: "reports", roles: ROLE_GROUPS.reports },
  { to: "/file-upload", labelKey: "fileUpload", roles: ROLE_GROUPS.documents },
];
