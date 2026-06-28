export const LEDGER_ACCOUNTS = Object.freeze([
  { account_code: "1000", account_name: "Cash", account_type: "Asset" },
  { account_code: "1100", account_name: "Accounts Receivable", account_type: "Asset" },
  { account_code: "4000", account_name: "Customs Duty Revenue", account_type: "Revenue" },
  { account_code: "4100", account_name: "VAT Revenue", account_type: "Revenue" },
  { account_code: "4200", account_name: "Excise Revenue", account_type: "Revenue" },
  { account_code: "4300", account_name: "Surtax Revenue", account_type: "Revenue" },
  { account_code: "5000", account_name: "Refund Liability", account_type: "Liability" },
]);

const accountByCode = new Map(LEDGER_ACCOUNTS.map((account) => [account.account_code, account]));

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function toDateKey(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function methodOf(row) {
  const raw = String(row.payment_method || row.provider || "").toLowerCase();
  if (raw.includes("tele")) return "Telebirr";
  if (raw.includes("chapa")) return "Chapa";
  if (raw.includes("cbe")) return "CBE";
  return row.payment_method || row.provider || "Unspecified";
}

function accountLabel(code) {
  const account = accountByCode.get(code);
  return account ? `${account.account_code} ${account.account_name}` : code;
}

function pushEntry(rows, base, accountCode, debit, credit, suffix) {
  const account = accountByCode.get(accountCode);
  rows.push({
    ...base,
    row_id: `${base.journal_no}-${suffix}`,
    account_code: accountCode,
    account_name: account?.account_name || accountCode,
    account_type: account?.account_type || "Revenue",
    account: accountLabel(accountCode),
    debit: toNumber(debit),
    credit: toNumber(credit),
    status: base.posting_status,
  });
}

export function buildAccountingLedger({ payments = [], refunds = [] } = {}) {
  const journalRows = [];

  payments.filter((row) => String(row.payment_status) === "Paid").forEach((row, index) => {
    const total = toNumber(row.paid_amount || row.total_payable);
    if (!total) return;

    const journalNo = `JE-${String(index + 1).padStart(3, "0")}`;
    const base = {
      journal_no: journalNo,
      reference: row.payment_order_no || row.transaction_id || `PAY-${String(row.payment_id || index + 1).slice(0, 8)}`,
      payment_id: row.payment_id || null,
      refund_id: null,
      declaration_id: row.declaration_id || null,
      declaration: row.declaration_no || String(row.declaration_id || "-").slice(0, 8),
      importer: row.importer_name || row.company_name || "-",
      transaction_date: toDateKey(row.payment_date || row.updated_at || row.created_at),
      created_by: row.verified_by || row.approved_by || "Finance Officer",
      description: `Payment posted for ${row.declaration_no || "customs declaration"}`,
      posting_status: "Posted",
      transaction_type: "Payment",
      provider: methodOf(row),
    };

    pushEntry(journalRows, base, "1000", total, 0, "cash");

    const revenueParts = [
      ["4000", toNumber(row.duty_paid)],
      ["4100", toNumber(row.vat_paid)],
      ["4200", toNumber(row.excise_paid)],
      ["4300", toNumber(row.surtax_paid)],
    ];
    const knownRevenue = revenueParts.reduce((totalPart, [, amount]) => totalPart + amount, 0);
    const parts = revenueParts.filter(([, amount]) => amount > 0);
    const otherRevenue = Math.max(0, total - knownRevenue);
    if (otherRevenue > 0.01) parts.push(["4000", otherRevenue]);

    parts.forEach(([accountCode, amount], partIndex) => {
      pushEntry(journalRows, base, accountCode, 0, amount, `${accountCode}-${partIndex}`);
    });
  });

  refunds.filter((row) => String(row.status) === "Completed").forEach((row, index) => {
    const amount = toNumber(row.amount);
    if (!amount) return;

    const journalNo = `JE-R${String(index + 1).padStart(3, "0")}`;
    const base = {
      journal_no: journalNo,
      reference: row.gateway_ref || `REF-${String(row.refund_id || index + 1).slice(0, 8)}`,
      payment_id: row.payment_id || null,
      refund_id: row.refund_id || null,
      declaration_id: row.declaration_id || null,
      declaration: row.declaration_no || String(row.declaration_id || "-").slice(0, 8),
      importer: row.importer_name || row.company_name || "-",
      transaction_date: toDateKey(row.updated_at || row.created_at),
      created_by: row.reviewed_by || "Finance Officer",
      description: row.reason || "Refund completed",
      posting_status: "Posted",
      transaction_type: "Refund",
      provider: row.provider || row.payment_method || "Gateway",
    };
    pushEntry(journalRows, base, "5000", amount, 0, "liability");
    pushEntry(journalRows, base, "1000", 0, amount, "cash");
  });

  const runningByAccount = new Map();
  const generalLedger = journalRows.map((row) => {
    const previous = runningByAccount.get(row.account_code) || 0;
    const next = row.account_type === "Revenue" || row.account_type === "Liability"
      ? previous + row.credit - row.debit
      : previous + row.debit - row.credit;
    runningByAccount.set(row.account_code, next);
    return { ...row, balance: next };
  });

  const balanceMap = new Map(LEDGER_ACCOUNTS.map((account) => [account.account_code, {
    account_code: account.account_code,
    account_name: account.account_name,
    account_type: account.account_type,
    account: accountLabel(account.account_code),
    debit: 0,
    credit: 0,
    balance: 0,
  }]));

  journalRows.forEach((row) => {
    const current = balanceMap.get(row.account_code);
    current.debit += row.debit;
    current.credit += row.credit;
    current.balance = current.account_type === "Revenue" || current.account_type === "Liability"
      ? current.credit - current.debit
      : current.debit - current.credit;
  });

  const accountBalances = Array.from(balanceMap.values());
  const totalDebit = journalRows.reduce((total, row) => total + row.debit, 0);
  const totalCredit = journalRows.reduce((total, row) => total + row.credit, 0);
  const matchedCount = payments.filter((row) => {
    const systemAmount = toNumber(row.total_payable);
    const gatewayAmount = toNumber(row.paid_amount || row.total_payable);
    return String(row.payment_status || "") !== "Pending" && Math.abs(systemAmount - gatewayAmount) < 0.01;
  }).length;
  const mismatchCount = payments.filter((row) => {
    const systemAmount = toNumber(row.total_payable);
    const gatewayAmount = toNumber(row.paid_amount || row.total_payable);
    return String(row.payment_status || "") !== "Pending" && Math.abs(systemAmount - gatewayAmount) >= 0.01;
  }).length;
  const pendingCount = payments.filter((row) => String(row.payment_status || "Pending") === "Pending").length;

  return {
    accounts: LEDGER_ACCOUNTS,
    generalLedger,
    journalEntries: journalRows,
    accountBalances,
    trialBalance: {
      rows: accountBalances,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    reconciliation: {
      matchedCount,
      mismatchCount,
      pendingCount,
    },
  };
}
