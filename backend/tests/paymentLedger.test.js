import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountingLedger } from "../src/utils/accountingLedger.js";

test("buildAccountingLedger creates balanced double-entry payment postings", () => {
  const accounting = buildAccountingLedger({
    payments: [
      {
        payment_id: "pay-001",
        declaration_id: "dec-001",
        declaration_no: "DEC001",
        company_name: "Addis Trading",
        payment_status: "Paid",
        payment_order_no: "PAY001",
        payment_method: "Telebirr",
        paid_amount: 300000,
        total_payable: 300000,
        duty_paid: 250000,
        vat_paid: 50000,
        payment_date: "2026-06-20",
      },
    ],
    refunds: [],
  });

  assert.equal(accounting.trialBalance.balanced, true);
  assert.equal(accounting.trialBalance.totalDebit, 300000);
  assert.equal(accounting.trialBalance.totalCredit, 300000);
  assert.equal(accounting.journalEntries.length, 3);
  assert.equal(accounting.accountBalances.find((row) => row.account_code === "1000").balance, 300000);
  assert.equal(accounting.accountBalances.find((row) => row.account_code === "4000").balance, 250000);
  assert.equal(accounting.accountBalances.find((row) => row.account_code === "4100").balance, 50000);
  assert.equal(accounting.reconciliation.matchedCount, 1);
});

test("buildAccountingLedger posts completed refunds against refund liability and cash", () => {
  const accounting = buildAccountingLedger({
    payments: [],
    refunds: [
      {
        refund_id: "ref-001",
        payment_id: "pay-001",
        declaration_id: "dec-001",
        declaration_no: "DEC001",
        status: "Completed",
        amount: 10000,
        gateway_ref: "GW-001",
        reason: "Overpayment",
        updated_at: "2026-06-20",
      },
    ],
  });

  assert.equal(accounting.trialBalance.balanced, true);
  assert.equal(accounting.trialBalance.totalDebit, 10000);
  assert.equal(accounting.trialBalance.totalCredit, 10000);
  assert.equal(accounting.accountBalances.find((row) => row.account_code === "5000").balance, -10000);
  assert.equal(accounting.accountBalances.find((row) => row.account_code === "1000").balance, -10000);
});
