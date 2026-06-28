import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, rolesForPermission } from "../src/utils/permissions.js";

test("Finance Officer can perform finance controls but not final clearance", () => {
  assert.equal(hasPermission("Finance Officer", "VIEW_PAYMENTS"), true);
  assert.equal(hasPermission("Finance Officer", "VERIFY_PAYMENTS"), true);
  assert.equal(hasPermission("Finance Officer", "APPROVE_REFUNDS"), true);
  assert.equal(hasPermission("Finance Officer", "FINAL_CLEARANCE"), false);
  assert.equal(hasPermission("Finance Officer", "MANAGE_USERS"), false);
});

test("permission lookup normalizes role names", () => {
  assert.equal(hasPermission(" finance   officer ", "VIEW_REVENUE_REPORTS"), true);
  assert.deepEqual(rolesForPermission("FINAL_CLEARANCE"), ["Super Admin", "Admin", "Customs Officer", "Clearance Officer"]);
});
