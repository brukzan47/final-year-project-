import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PaymentsAPI, RefundsAPI } from "../api/paymentAPI.js";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../context/ToastContext.jsx";
import customsLogo from "../assets/customs-logo.png";
import logoEt from "../assets/logo-et.png";
import headerBanner from "../assets/header-banner.jpg";
import providerCbe from "../assets/provider-cbe.svg";
import providerTelebirr from "../assets/provider-telebirr.svg";
import providerChapa from "../assets/provider-chapa.svg";
import "../styles/shipmentWizard.css";
import "../styles/financeOfficer.css";

const FINANCE_ROUTES = {
  dashboard: "/finance",
  queue: "/finance/queue",
  verified: "/finance/verified",
  failed: "/finance/failed",
  ledger: "/finance/ledger",
  journal: "/finance/journal",
  balances: "/finance/balances",
  trialBalance: "/finance/trial-balance",
  reconciliation: "/finance/reconciliation",
  audit: "/finance/audit",
  analytics: "/finance/analytics",
  refunds: "/finance/refunds",
  reports: "/finance/reports",
  receipts: "/finance/receipts",
};

const MENU = [
  { id: "dashboard", label: "Dashboard" },
  { id: "queue", label: "Payment Queue" },
  {
    id: "ledgerGroup",
    label: "Ledger",
    children: [
      { id: "ledger", label: "General Ledger" },
      { id: "journal", label: "Journal Entries" },
      { id: "balances", label: "Account Balances" },
      { id: "trialBalance", label: "Trial Balance" },
      { id: "reconciliation", label: "Reconciliation" },
      { id: "audit", label: "Audit Trail" },
    ],
  },
  { id: "analytics", label: "Revenue Analytics" },
  { id: "refunds", label: "Refunds" },
  { id: "reports", label: "Reports" },
  { id: "profile", label: "Profile" },
];

const METHODS = ["CBE", "Telebirr", "Chapa"];
const OFFICES = ["Modjo", "Bole", "Dire Dawa"];
const RISK_CHANNELS = ["Green", "Yellow", "Red"];
const ACCOUNT_CATALOG = [
  { code: "1000", name: "Cash", type: "Asset" },
  { code: "1100", name: "Accounts Receivable", type: "Asset" },
  { code: "4000", name: "Customs Duty Revenue", type: "Revenue" },
  { code: "4100", name: "VAT Revenue", type: "Revenue" },
  { code: "4200", name: "Excise Revenue", type: "Revenue" },
  { code: "4300", name: "Surtax Revenue", type: "Revenue" },
  { code: "5000", name: "Refund Liability", type: "Liability" },
];
const FINANCE_WORKFLOW = [
  "Payment Generated",
  "Importer Pays",
  "Gateway Callback",
  "Finance Verification",
  "Receipt Generated",
  "Revenue Recorded",
  "Officer Clearance Allowed",
];
const KPI_TARGETS = [
  ["Payment Verification Accuracy", "100%"],
  ["Revenue Reconciliation Accuracy", "100%"],
  ["Refund Processing Time", "< 24 Hours"],
  ["Failed Transaction Resolution", "< 4 Hours"],
  ["Report Accuracy", "100%"],
];
const FINANCE_PERMISSIONS = [
  ["View Payments", true],
  ["Verify Payments", true],
  ["Reject Payments", true],
  ["Approve Refunds", true],
  ["View Revenue Reports", true],
  ["Generate Receipts", true],
  ["Create Users", false],
  ["Change Tariff Rates", false],
  ["Final Customs Clearance", false],
  ["Modify Declarations", false],
];
const FINANCE_DELIVERABLES = [
  "Revenue Protection",
  "Accurate Tax Collection",
  "Payment Verification",
  "Financial Transparency",
  "Audit Compliance",
  "Revenue Reporting",
  "Refund Control",
  "Reconciliation Accuracy",
];
const PAYMENT_INTEGRATIONS = [
  ["CBE", providerCbe, "Initiate Payment", "Verify Callback", "Generate Receipt"],
  ["Telebirr", providerTelebirr, "QR Payment", "Callback Verification", "Status Update"],
  ["Chapa", providerChapa, "Hosted Checkout", "Webhook Verification", "Receipt Generation"],
];

function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateKey(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function monthKey(value) {
  if (!value) return "Unscheduled";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function paymentDate(row) {
  return row.payment_date || row.updated_at || row.created_at;
}

function methodOf(row) {
  const raw = String(row.payment_method || row.provider || "").toLowerCase();
  if (raw.includes("tele")) return "Telebirr";
  if (raw.includes("chapa")) return "Chapa";
  if (raw.includes("cbe")) return "CBE";
  return row.payment_method || "Unspecified";
}

function sum(rows, filter = () => true) {
  return rows.filter(filter).reduce((total, row) => total + Number(row.total_payable || row.paid_amount || 0), 0);
}

function sumField(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function csvDownload(filename, rows) {
  if (!rows.length) return;
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function activeFromPath(pathname) {
  const normalized = (pathname || "/finance").replace(/\/+$/, "") || "/finance";
  const match = Object.entries(FINANCE_ROUTES).find(([, route]) => route === normalized);
  return match?.[0] || "dashboard";
}

function menuLabel(id) {
  for (const item of MENU) {
    if (item.id === id) return item.label;
    const child = item.children?.find((entry) => entry.id === id);
    if (child) return child.label;
  }
  return "Dashboard";
}

function accountText(code, name) {
  return `${code} ${name}`;
}

function GroupBars({ title, rows, getKey }) {
  const data = useMemo(() => {
    const map = new Map();
    rows.forEach((row, index) => {
      const key = getKey(row, index) || "Unspecified";
      map.set(key, (map.get(key) || 0) + Number(row.total_payable || row.paid_amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows, getKey]);
  const max = Math.max(...data.map(([, value]) => value), 1);

  return (
    <section className="finance-panel">
      <h3>{title}</h3>
      <div className="finance-bars">
        {data.map(([label, value]) => (
          <div key={label} className="finance-bar-row">
            <span>{label}</span>
            <div className="finance-bar-track"><i style={{ width: `${Math.max(6, (value / max) * 100)}%` }} /></div>
            <strong>{money(value)}</strong>
          </div>
        ))}
        {!data.length && <div className="finance-empty">No data available.</div>}
      </div>
    </section>
  );
}

function FinanceTable({ columns, rows, empty = "No records found." }) {
  return (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.payment_id || row.refund_id || row.event_id || row.receipt_no || index}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render ? column.render(row) : row[column.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={columns.length} className="finance-empty">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function FinanceOfficer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(() => activeFromPath(location.pathname));
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [accountingLedger, setAccountingLedger] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [ledgerFilters, setLedgerFilters] = useState({
    from: "",
    to: "",
    declaration: "",
    importer: "",
    account: "",
    type: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const toast = useToast();

  const goFinance = (id) => {
    if (id === "profile") {
      navigate("/profile");
      return;
    }
    setActive(id);
    navigate(FINANCE_ROUTES[id] || "/finance");
  };

  const load = async () => {
    setLoading(true);
    try {
      const [rows, financeSummary, logs, ledgerRows, accountingRows, refundRows] = await Promise.all([
        PaymentsAPI.list(),
        PaymentsAPI.summary(),
        PaymentsAPI.auditLogs(),
        PaymentsAPI.ledger(),
        PaymentsAPI.accountingLedger().catch(() => null),
        RefundsAPI.list(),
      ]);
      setPayments(Array.isArray(rows) ? rows : []);
      setSummary(financeSummary || null);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setLedger(Array.isArray(ledgerRows) ? ledgerRows : []);
      setAccountingLedger(accountingRows || null);
      setRefunds(Array.isArray(refundRows) ? refundRows : []);
    } catch (error) {
      toast?.error?.(error.message || "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setActive(activeFromPath(location.pathname));
  }, [location.pathname]);

  const today = dateKey(new Date());
  const thisMonth = new Date().toISOString().slice(0, 7);
  const paid = payments.filter((row) => String(row.payment_status) === "Paid");
  const pending = payments.filter((row) => String(row.payment_status || "Pending") === "Pending");
  const verified = payments.filter((row) => String(row.payment_status) === "Verified");
  const failed = payments.filter((row) => String(row.payment_status) === "Failed");
  const receiptPreview = paid[0] || null;

  const kpis = [
    ["Today's Revenue", `${money(sum(paid, (row) => dateKey(paymentDate(row)) === today))} ETB`],
    ["Monthly Revenue", `${money(sum(paid, (row) => String(paymentDate(row) || "").slice(0, 7) === thisMonth))} ETB`],
    ["Pending Payments", Number(summary?.pending_count ?? pending.length)],
    ["Verified Payments", Number(summary?.verified_count ?? verified.length)],
    ["Failed Transactions", Number(summary?.failed_count ?? failed.length)],
    ["Refund Requests", refunds.length],
  ];
  const duty = sumField(paid, "duty_paid");
  const vat = sumField(paid, "vat_paid");
  const excise = sumField(paid, "excise_paid");
  const surtax = sumField(paid, "surtax_paid");
  const totalCollected = sum(paid);
  const knownTaxTotal = duty + vat + excise + surtax;
  const taxRows = [
    ["Import Duty", duty],
    ["VAT", vat],
    ["Excise Tax", excise],
    ["Surtax", surtax],
    ["Other Customs Charges", Math.max(0, totalCollected - knownTaxTotal)],
    ["Total", totalCollected],
  ];

  const auditRows = auditLogs.map((row) => ({
    event_id: row.event_id,
    user: row.actor || "System",
    action: String(row.event_type || "payment_event").replace(/_/g, " "),
    time: row.created_at ? new Date(row.created_at).toLocaleString() : "-",
    declaration: row.declaration_no || String(row.declaration_id || "-").slice(0, 8),
  }));

  const reconciliationRows = payments.map((row) => {
    const systemAmount = Number(row.total_payable || 0);
    const gatewayAmount = Number(row.paid_amount || row.total_payable || 0);
    const difference = gatewayAmount - systemAmount;
    const status = String(row.payment_status || "Pending") === "Pending" ? "Pending" : Math.abs(difference) < 0.01 ? "Matched" : "Mismatch";
    return {
      ...row,
      systemAmount,
      gatewayAmount,
      difference,
      provider: methodOf(row),
      match: status === "Matched",
      reconciliationStatus: status,
    };
  });
  const notificationRows = [
    ["New Payment Received", pending.length, "Payments waiting for verification"],
    ["Refund Request Submitted", refunds.filter((row) => row.status !== "Completed" && row.status !== "Rejected").length, "Refunds requiring finance control"],
    ["Gateway Failure Detected", failed.length, "Failed, duplicate, expired, or callback error transactions"],
    ["Large Transaction Alert", payments.filter((row) => Number(row.total_payable || row.paid_amount || 0) >= 1000000).length, "Payments at or above 1,000,000 ETB"],
    ["Reconciliation Mismatch", reconciliationRows.filter((row) => !row.match).length, "System and gateway amount differences"],
  ];
  const completedRefunds = refunds.filter((row) => row.status === "Completed");
  const pendingRefunds = refunds.filter((row) => row.status !== "Completed" && row.status !== "Rejected");
  const outstandingBalance = sum([...pending, ...verified]);
  const refundExposure = pendingRefunds.reduce((total, row) => total + Number(row.amount || 0), 0);

  const journalRows = [];
  paid.forEach((row, index) => {
    const total = Number(row.paid_amount || row.total_payable || 0);
    if (!total) return;
    const journalNo = `JE-${String(index + 1).padStart(3, "0")}`;
    const base = {
      journal_no: journalNo,
      reference: row.payment_order_no || row.transaction_id || `PAY-${String(row.payment_id || index + 1).slice(0, 8)}`,
      declaration: row.declaration_no || String(row.declaration_id || "-").slice(0, 8),
      importer: row.importer_name || row.company_name || "-",
      date: dateKey(paymentDate(row)) || today,
      created_by: row.verified_by || row.approved_by || "Finance Officer",
      description: `Payment posted for ${row.declaration_no || "customs declaration"}`,
      posting_status: "Posted",
      transaction_type: "Payment",
      provider: methodOf(row),
    };
    journalRows.push({
      ...base,
      row_id: `${journalNo}-cash`,
      account_code: "1000",
      account_name: "Cash",
      account: accountText("1000", "Cash"),
      debit: total,
      credit: 0,
    });
    const revenueParts = [
      ["4000", "Customs Duty Revenue", Number(row.duty_paid || 0)],
      ["4100", "VAT Revenue", Number(row.vat_paid || 0)],
      ["4200", "Excise Revenue", Number(row.excise_paid || 0)],
      ["4300", "Surtax Revenue", Number(row.surtax_paid || 0)],
    ];
    const knownRevenue = revenueParts.reduce((totalPart, [, , amount]) => totalPart + amount, 0);
    const parts = [...revenueParts.filter(([, , amount]) => amount > 0)];
    const otherRevenue = Math.max(0, total - knownRevenue);
    if (otherRevenue > 0.01) parts.push(["4000", "Customs Duty Revenue", otherRevenue]);
    parts.forEach(([code, name, amount], partIndex) => {
      journalRows.push({
        ...base,
        row_id: `${journalNo}-${code}-${partIndex}`,
        account_code: code,
        account_name: name,
        account: accountText(code, name),
        debit: 0,
        credit: amount,
      });
    });
  });

  completedRefunds.forEach((row, index) => {
    const amount = Number(row.amount || 0);
    if (!amount) return;
    const journalNo = `JE-R${String(index + 1).padStart(3, "0")}`;
    const base = {
      journal_no: journalNo,
      reference: row.gateway_ref || `REF-${String(row.refund_id || index + 1).slice(0, 8)}`,
      declaration: row.declaration_no || String(row.declaration_id || "-").slice(0, 8),
      importer: row.importer_name || row.company_name || "-",
      date: dateKey(row.updated_at || row.created_at) || today,
      created_by: row.reviewed_by || "Finance Officer",
      description: row.reason || "Refund completed",
      posting_status: "Posted",
      transaction_type: "Refund",
      provider: row.provider || "Gateway",
    };
    journalRows.push({
      ...base,
      row_id: `${journalNo}-liability`,
      account_code: "5000",
      account_name: "Refund Liability",
      account: accountText("5000", "Refund Liability"),
      debit: amount,
      credit: 0,
    });
    journalRows.push({
      ...base,
      row_id: `${journalNo}-cash`,
      account_code: "1000",
      account_name: "Cash",
      account: accountText("1000", "Cash"),
      debit: 0,
      credit: amount,
    });
  });

  const backendJournalRows = Array.isArray(accountingLedger?.journalEntries) ? accountingLedger.journalEntries : [];
  const displayJournalRows = (backendJournalRows.length ? backendJournalRows : journalRows).map((row) => ({
    ...row,
    date: row.date || row.transaction_date || today,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    status: row.status || row.posting_status || "Posted",
    posting_status: row.posting_status || row.status || "Posted",
  }));

  const runningByAccount = new Map();
  const generalLedgerRows = displayJournalRows.map((row) => {
    const accountMeta = ACCOUNT_CATALOG.find((account) => account.code === row.account_code);
    const previous = runningByAccount.get(row.account_code) || 0;
    const next = accountMeta?.type === "Revenue" || accountMeta?.type === "Liability"
      ? previous + Number(row.credit || 0) - Number(row.debit || 0)
      : previous + Number(row.debit || 0) - Number(row.credit || 0);
    runningByAccount.set(row.account_code, next);
    return { ...row, balance: next, status: row.posting_status };
  });

  const filteredLedgerRows = generalLedgerRows.filter((row) => {
    const filters = ledgerFilters;
    const rowDate = row.date || "";
    if (filters.from && rowDate < filters.from) return false;
    if (filters.to && rowDate > filters.to) return false;
    if (filters.declaration && !String(row.declaration || "").toLowerCase().includes(filters.declaration.toLowerCase())) return false;
    if (filters.importer && !String(row.importer || "").toLowerCase().includes(filters.importer.toLowerCase())) return false;
    if (filters.account && row.account_code !== filters.account) return false;
    if (filters.type && row.transaction_type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });

  const accountBalanceMap = ACCOUNT_CATALOG.reduce((map, account) => {
    map.set(account.code, {
      account: accountText(account.code, account.name),
      account_code: account.code,
      account_name: account.name,
      type: account.type,
      debit: 0,
      credit: 0,
      balance: 0,
    });
    return map;
  }, new Map());
  displayJournalRows.forEach((row) => {
    const current = accountBalanceMap.get(row.account_code) || {
      account: row.account,
      account_code: row.account_code,
      account_name: row.account_name,
      type: "Revenue",
      debit: 0,
      credit: 0,
      balance: 0,
    };
    current.debit += Number(row.debit || 0);
    current.credit += Number(row.credit || 0);
    current.balance = current.type === "Revenue" || current.type === "Liability"
      ? current.credit - current.debit
      : current.debit - current.credit;
    accountBalanceMap.set(row.account_code, current);
  });
  const accountBalanceRows = Array.from(accountBalanceMap.values());
  const trialDebit = displayJournalRows.reduce((total, row) => total + Number(row.debit || 0), 0);
  const trialCredit = displayJournalRows.reduce((total, row) => total + Number(row.credit || 0), 0);
  const trialBalanced = Math.abs(trialDebit - trialCredit) < 0.01;
  const ledgerBalance = accountBalanceRows.reduce((total, row) => total + Number(row.balance || 0), 0);
  const todayCollections = sum(paid, (row) => dateKey(paymentDate(row)) === today);
  const dashboardLedgerCards = [
    ["General Ledger Balance", `${money(ledgerBalance)} ETB`],
    ["Daily Revenue", `${money(todayCollections)} ETB`],
    ["Outstanding Receivables", `${money(outstandingBalance)} ETB`],
    ["Refund Exposure", `${money(refundExposure)} ETB`],
    ["Reconciliation Status", trialBalanced ? "Balanced" : "Review"],
  ];

  const downloadReceipt = async (row) => {
    try {
      const blob = await PaymentsAPI.downloadReceipt(row.payment_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${row.payment_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast?.error?.(error.message || "Receipt download failed");
    }
  };

  const verifyPayment = async (row) => {
    setBusyId(row.payment_id);
    try {
      await PaymentsAPI.verify(row.payment_id);
      toast?.success?.("Payment verified");
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Verification failed");
    } finally {
      setBusyId("");
    }
  };

  const approvePayment = async (row) => {
    setBusyId(row.payment_id);
    try {
      await PaymentsAPI.approve(row.payment_id);
      toast?.success?.("Payment approved and locked");
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Approval failed");
    } finally {
      setBusyId("");
    }
  };

  const retryPayment = async (row) => {
    setBusyId(row.payment_id);
    try {
      await PaymentsAPI.reverify(row.payment_id);
      toast?.success?.("Transaction reset to Pending");
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Retry failed");
    } finally {
      setBusyId("");
    }
  };

  const rejectPayment = async (row) => {
    setBusyId(row.payment_id);
    try {
      await PaymentsAPI.reject(row.payment_id, { reason: "MANUAL_REJECT" });
      toast?.success?.("Payment rejected");
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Rejection failed");
    } finally {
      setBusyId("");
    }
  };

  const createRefund = async (row) => {
    setBusyId(row.payment_id);
    try {
      await RefundsAPI.create({
        payment_id: row.payment_id,
        amount: Number(row.paid_amount || row.total_payable || 0),
        reason: "Overpayment",
      });
      toast?.success?.("Refund request created");
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Refund request failed");
    } finally {
      setBusyId("");
    }
  };

  const updateRefund = async (row, status) => {
    setBusyId(row.refund_id);
    try {
      await RefundsAPI.updateStatus(row.refund_id, {
        status,
        gateway_ref: status === "Completed" ? `GW-${String(row.refund_id).slice(0, 8)}` : undefined,
      });
      toast?.success?.(`Refund ${status.toLowerCase()}`);
      await load();
    } catch (error) {
      toast?.error?.(error.message || "Refund update failed");
    } finally {
      setBusyId("");
    }
  };

  const renderActions = (row) => (
    <div className="finance-actions">
      {String(row.payment_status || "Pending") === "Pending" && (
        <button type="button" onClick={() => verifyPayment(row)} disabled={busyId === row.payment_id}>Verify</button>
      )}
      {String(row.payment_status || "Pending") === "Pending" && (
        <button type="button" onClick={() => rejectPayment(row)} disabled={busyId === row.payment_id}>Reject</button>
      )}
      {String(row.payment_status) === "Verified" && (
        <button type="button" className="primary" onClick={() => approvePayment(row)} disabled={busyId === row.payment_id}>Mark Paid</button>
      )}
      {String(row.payment_status) === "Failed" && (
        <button type="button" onClick={() => retryPayment(row)} disabled={busyId === row.payment_id}>Retry</button>
      )}
      {String(row.payment_status) === "Paid" && (
        <button type="button" onClick={() => downloadReceipt(row)}>Receipt</button>
      )}
    </div>
  );

  const paymentColumns = [
    { key: "payment_id", label: "Payment ID", render: (row) => String(row.payment_id || "-").slice(0, 8) },
    { key: "declaration", label: "Declaration", render: (row) => row.declaration_no || String(row.declaration_id || "-").slice(0, 8) },
    { key: "importer", label: "Importer", render: (row) => row.importer_name || row.company_name || "-" },
    { key: "amount", label: "Amount", render: (row) => `${money(row.total_payable)} ETB` },
    { key: "method", label: "Method", render: methodOf },
    { key: "date", label: "Date", render: (row) => dateKey(paymentDate(row)) || "-" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.payment_status || "Pending"} /> },
    { key: "actions", label: "Actions", render: renderActions },
  ];

  const receiptColumns = [
    { key: "receipt_no", label: "Receipt No", render: (row) => row.receipt_no || `RCPT-${String(row.payment_id || "").slice(0, 8)}` },
    { key: "importer", label: "Importer", render: (row) => row.importer_name || row.company_name || "-" },
    { key: "amount", label: "Amount", render: (row) => `${money(row.total_payable)} ETB` },
    { key: "date", label: "Date", render: (row) => dateKey(paymentDate(row)) || "-" },
    { key: "actions", label: "Actions", render: (row) => <div className="finance-actions"><button type="button" onClick={() => downloadReceipt(row)}>Download</button><button type="button" onClick={() => toast?.info?.("Email workflow queued")}>Email</button><button type="button" onClick={() => window.print()}>Print</button></div> },
  ];

  return (
    <div className="finance-page-shell">
      <div className="finance-page-panel finance-page">
        <header className="finance-hero eu-head" style={{ backgroundImage: `linear-gradient(120deg, rgba(7, 137, 63, 0.18), rgba(252, 209, 22, 0.18), rgba(218, 41, 28, 0.18)), url(${headerBanner})` }}>
          <div className="finance-hero-copy">
            <img src={logoEt} alt="Ethiopian Import Management System" />
            <div>
              <span className="finance-kicker">Government finance operations</span>
              <h2>Finance Officer Module</h2>
              <p>Ethiopian Import Management System revenue control, payment verification, refunds, reconciliation, reporting, and audit compliance.</p>
            </div>
          </div>
        </header>

      <div className="finance-shell">
        <aside className="finance-sidebar">
          <div className="finance-brand">
            <img src={customsLogo} alt="Ethiopian Import Management System" />
            <span>Finance Officer</span>
            <strong>Revenue Control</strong>
          </div>
          <nav>
            {MENU.map((item) => item.children ? (
              <div key={item.id} className="finance-menu-group">
                <span>{item.label}</span>
                <div className="finance-subnav">
                  {item.children.map((child) => (
                    <button key={child.id} type="button" className={active === child.id ? "is-active" : ""} onClick={() => goFinance(child.id)}>
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => goFinance(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="finance-main">
          <section className="finance-header eu-card">
            <div>
              <span className="finance-kicker">Finance control desk</span>
              <h3>{menuLabel(active)}</h3>
              <p>No declaration is cleared without payment confirmation.</p>
            </div>
            <div className="finance-header-actions">
              <button type="button" className="eu-btn" onClick={load} disabled={loading}>Refresh</button>
              <button type="button" className="eu-btn primary" onClick={() => csvDownload("finance-payments.csv", payments)}>Download Report</button>
            </div>
          </section>

        {active === "dashboard" && (
          <>
            <section className="finance-kpi-grid">
              {kpis.map(([label, value]) => (
                <div key={label} className="finance-kpi">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
            <section className="finance-kpi-grid compact">
              {dashboardLedgerCards.map(([label, value]) => (
                <div key={label} className="finance-kpi">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
            <section className="finance-quick-actions">
              <button type="button" onClick={() => goFinance("queue")}>Verify Payment</button>
              <button type="button" onClick={() => goFinance("refunds")}>Issue Refund</button>
              <button type="button" onClick={() => csvDownload("daily-revenue-report.csv", paid)}>Download Report</button>
              <button type="button" onClick={() => goFinance("audit")}>View Audit Logs</button>
            </section>
            <section className="finance-control-grid">
              <div className="finance-panel">
                <h3>Finance Notifications</h3>
                <div className="finance-notifications">
                  {notificationRows.map(([title, count, body]) => (
                    <button key={title} type="button" className={count ? "finance-notification active" : "finance-notification"} onClick={() => title.includes("Refund") ? goFinance("refunds") : title.includes("Failure") ? goFinance("failed") : title.includes("Reconciliation") ? goFinance("reconciliation") : goFinance("queue")}>
                      <strong>{count}</strong>
                      <span>{title}</span>
                      <small>{body}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="finance-panel">
                <h3>Ethiopian Payment Integration</h3>
                <div className="finance-provider-grid">
                  {PAYMENT_INTEGRATIONS.map(([name, icon, ...steps]) => (
                    <div key={name} className="finance-provider-card">
                      <img src={icon} alt={name} />
                      <strong>{name}</strong>
                      {steps.map((step) => <span key={step}>{step}</span>)}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="finance-chart-grid">
              <GroupBars title="Revenue by Month" rows={paid} getKey={(row) => monthKey(paymentDate(row))} />
              <GroupBars title="Revenue by Payment Method" rows={paid} getKey={methodOf} />
              <GroupBars title="Top HS Codes by Revenue" rows={paid} getKey={(row) => row.hs_code || "Unassigned"} />
              <GroupBars title="Daily Collections" rows={paid} getKey={(row) => dateKey(paymentDate(row)) || "No date"} />
              <GroupBars title="Revenue by Tax Type" rows={[
                { total_payable: duty, tax_type: "Duty" },
                { total_payable: vat, tax_type: "VAT" },
                { total_payable: excise, tax_type: "Excise" },
                { total_payable: surtax, tax_type: "Surtax" },
              ]} getKey={(row) => row.tax_type} />
            </div>
            <section className="finance-control-grid">
              <div className="finance-panel">
                <div className="finance-panel-head"><h3>Ledger Summary</h3><span>Account balances</span></div>
                <FinanceTable columns={[
                  { key: "account", label: "Account" },
                  { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
                  { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
                  { key: "balance", label: "Balance", render: (row) => `${money(row.balance)} ETB` },
                ]} rows={accountBalanceRows.slice(0, 5)} />
              </div>
              <div className="finance-panel">
                <div className="finance-panel-head"><h3>Recent Journal Entries</h3><span>Latest postings</span></div>
                <FinanceTable columns={[
                  { key: "journal_no", label: "Journal" },
                  { key: "account", label: "Account" },
                  { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
                  { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
                ]} rows={displayJournalRows.slice(0, 6)} />
              </div>
            </section>
            <section className="finance-control-grid">
              <div className="finance-panel">
                <h3>Duty & Tax Monitoring</h3>
                <table className="finance-mini-table">
                  <tbody>
                    {taxRows.map(([label, value]) => (
                      <tr key={label}>
                        <th>{label}</th>
                        <td>{money(value)} ETB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="finance-panel">
                <h3>Finance Workflow</h3>
                <div className="finance-flow">
                  {FINANCE_WORKFLOW.map((step, index) => (
                    <span key={step} className="finance-flow-step">
                      <b>{index + 1}</b>{step}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            <section className="finance-control-grid">
              <div className="finance-panel">
                <h3>Finance KPI Targets</h3>
                <div className="finance-targets">
                  {KPI_TARGETS.map(([label, target]) => (
                    <div key={label} className="finance-target">
                      <span>{label}</span>
                      <strong>{target}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="finance-panel">
                <h3>Finance Permissions</h3>
                <div className="finance-permissions">
                  {FINANCE_PERMISSIONS.map(([label, allowed]) => (
                    <div key={label} className={allowed ? "finance-permission allowed" : "finance-permission denied"}>
                      <span>{label}</span>
                      <strong>{allowed ? "Allowed" : "Blocked"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="finance-panel">
              <h3>Finance Deliverables</h3>
              <div className="finance-deliverables">
                {FINANCE_DELIVERABLES.map((item) => <span key={item}>{item}</span>)}
              </div>
            </section>
          </>
        )}

        {active === "queue" && (
          <section className="finance-panel">
            <div className="finance-panel-head"><h3>Payment Queue</h3><span>Pending - Verified - Paid</span></div>
            <FinanceTable columns={paymentColumns} rows={[...pending, ...verified]} />
          </section>
        )}

        {active === "verified" && (
          <section className="finance-panel">
            <h3>Verified Payments</h3>
            <FinanceTable columns={paymentColumns} rows={[...verified, ...paid]} />
          </section>
        )}

        {active === "failed" && (
          <section className="finance-panel">
            <h3>Failed Transactions</h3>
            <FinanceTable columns={[
              { key: "transaction", label: "Transaction", render: (row) => row.transaction_id || String(row.payment_id || "-").slice(0, 8) },
              { key: "importer", label: "Importer", render: (row) => row.importer_name || "-" },
              { key: "amount", label: "Amount", render: (row) => `${money(row.total_payable)} ETB` },
              { key: "error", label: "Error", render: (row) => row.failure_reason || "Gateway callback error" },
              { key: "actions", label: "Actions", render: (row) => <div className="finance-actions"><button type="button" onClick={() => retryPayment(row)}>Retry</button><button type="button" onClick={() => toast?.info?.("Investigation opened")}>Investigate</button><button type="button" onClick={() => toast?.success?.("Marked resolved")}>Mark Resolved</button></div> },
            ]} rows={failed} />
          </section>
        )}

        {active === "refunds" && (
          <section className="finance-panel">
            <div className="finance-panel-head"><h3>Refund Requests</h3><span>Importer Request - Finance Review - Approve Refund - Gateway Refund - Completed</span></div>
            <div className="finance-quick-actions" style={{ marginBottom: 12 }}>
              {paid.slice(0, 4).map((row) => (
                <button key={row.payment_id} type="button" onClick={() => createRefund(row)} disabled={busyId === row.payment_id}>
                  Request refund {row.declaration_no || String(row.payment_id).slice(0, 8)}
                </button>
              ))}
              {!paid.length && <span className="finance-empty">No paid payments are eligible for refund requests.</span>}
            </div>
            <FinanceTable columns={[
              { key: "refund_id", label: "Refund ID" },
              { key: "declaration", label: "Declaration", render: (row) => row.declaration_no || String(row.declaration_id || "-").slice(0, 8) },
              { key: "amount", label: "Amount", render: (row) => `${money(row.amount)} ETB` },
              { key: "reason", label: "Reason" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "actions", label: "Actions", render: (row) => (
                <div className="finance-actions">
                  {row.status === "Finance Review" && <button type="button" onClick={() => updateRefund(row, "Approved")} disabled={busyId === row.refund_id}>Approve Refund</button>}
                  {row.status === "Finance Review" && <button type="button" onClick={() => updateRefund(row, "Rejected")} disabled={busyId === row.refund_id}>Reject</button>}
                  {row.status === "Approved" && <button type="button" onClick={() => updateRefund(row, "Gateway Refund")} disabled={busyId === row.refund_id}>Gateway Refund</button>}
                  {row.status === "Gateway Refund" && <button type="button" onClick={() => updateRefund(row, "Completed")} disabled={busyId === row.refund_id}>Complete</button>}
                </div>
              ) },
            ]} rows={refunds} />
          </section>
        )}

        {active === "analytics" && (
          <>
            <section className="finance-kpi-grid compact">
              <div className="finance-kpi"><span>Today</span><strong>{money(sum(paid, (row) => dateKey(paymentDate(row)) === today))} ETB</strong></div>
              <div className="finance-kpi"><span>This Week</span><strong>{money(sum(paid.slice(0, 7)))} ETB</strong></div>
              <div className="finance-kpi"><span>This Month</span><strong>{money(sum(paid, (row) => String(paymentDate(row) || "").slice(0, 7) === thisMonth))} ETB</strong></div>
              <div className="finance-kpi"><span>This Year</span><strong>{money(sum(paid, (row) => String(paymentDate(row) || "").slice(0, 4) === String(new Date().getFullYear())))} ETB</strong></div>
            </section>
            <div className="finance-chart-grid">
              <GroupBars title="Revenue by Payment Method" rows={paid} getKey={methodOf} />
              <GroupBars title="Revenue by Customs Office" rows={paid} getKey={(row, index) => row.customs_station || OFFICES[index % OFFICES.length]} />
              <GroupBars title="Revenue by Risk Channel" rows={paid} getKey={(row, index) => row.risk_channel || RISK_CHANNELS[index % RISK_CHANNELS.length]} />
            </div>
          </>
        )}

        {active === "reconciliation" && (
          <section className="finance-panel">
            <div className="finance-panel-head"><h3>Reconciliation</h3><span>ECMS Ledger VS CBE VS Telebirr VS Chapa</span></div>
            <FinanceTable columns={[
              { key: "transaction", label: "Transaction", render: (row) => row.transaction_id || String(row.payment_id || "-").slice(0, 8) },
              { key: "system", label: "System", render: (row) => `${money(row.systemAmount)} ETB` },
              { key: "provider", label: "Gateway" },
              { key: "gatewayAmount", label: "Gateway Amount", render: (row) => `${money(row.gatewayAmount)} ETB` },
              { key: "difference", label: "Difference", render: (row) => `${money(row.difference)} ETB` },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.reconciliationStatus} /> },
              { key: "actions", label: "Actions", render: (row) => <div className="finance-actions"><button type="button" onClick={() => toast?.success?.("Record reconciled")}>Reconcile</button><button type="button" onClick={() => toast?.warn?.("Difference flagged")}>Flag Difference</button></div> },
            ]} rows={reconciliationRows} />
          </section>
        )}

        {active === "ledger" && (
          <>
            <section className="finance-kpi-grid">
              <div className="finance-kpi"><span>Total Revenue</span><strong>{money(totalCollected)} ETB</strong></div>
              <div className="finance-kpi"><span>Total Duty</span><strong>{money(duty)} ETB</strong></div>
              <div className="finance-kpi"><span>Total VAT</span><strong>{money(vat)} ETB</strong></div>
              <div className="finance-kpi"><span>Total Surtax</span><strong>{money(surtax)} ETB</strong></div>
              <div className="finance-kpi"><span>Today's Collections</span><strong>{money(todayCollections)} ETB</strong></div>
              <div className="finance-kpi"><span>Outstanding Balance</span><strong>{money(outstandingBalance)} ETB</strong></div>
            </section>
            <section className="finance-panel">
              <div className="finance-panel-head">
                <h3>General Ledger</h3>
                <span>Double-entry accounting history</span>
              </div>
              <div className="finance-filter-grid">
                <label><span>From</span><input type="date" value={ledgerFilters.from} onChange={(event) => setLedgerFilters({ ...ledgerFilters, from: event.target.value })} /></label>
                <label><span>To</span><input type="date" value={ledgerFilters.to} onChange={(event) => setLedgerFilters({ ...ledgerFilters, to: event.target.value })} /></label>
                <label><span>Declaration</span><input value={ledgerFilters.declaration} onChange={(event) => setLedgerFilters({ ...ledgerFilters, declaration: event.target.value })} placeholder="DEC001" /></label>
                <label><span>Importer</span><input value={ledgerFilters.importer} onChange={(event) => setLedgerFilters({ ...ledgerFilters, importer: event.target.value })} placeholder="Importer name" /></label>
                <label><span>Account</span><select value={ledgerFilters.account} onChange={(event) => setLedgerFilters({ ...ledgerFilters, account: event.target.value })}><option value="">All accounts</option>{ACCOUNT_CATALOG.map((account) => <option key={account.code} value={account.code}>{account.code} {account.name}</option>)}</select></label>
                <label><span>Type</span><select value={ledgerFilters.type} onChange={(event) => setLedgerFilters({ ...ledgerFilters, type: event.target.value })}><option value="">All types</option><option value="Payment">Payment</option><option value="Refund">Refund</option></select></label>
                <label><span>Status</span><select value={ledgerFilters.status} onChange={(event) => setLedgerFilters({ ...ledgerFilters, status: event.target.value })}><option value="">All statuses</option><option value="Posted">Posted</option></select></label>
              </div>
              <div className="finance-ledger-actions">
                <button type="button" onClick={() => csvDownload("general-ledger.csv", filteredLedgerRows)}>Export Excel</button>
                <button type="button" onClick={() => window.print()}>Export PDF</button>
                <button type="button" onClick={() => window.print()}>Print Ledger</button>
              </div>
              <FinanceTable columns={[
                { key: "date", label: "Date" },
                { key: "reference", label: "Reference" },
                { key: "declaration", label: "Declaration" },
                { key: "account", label: "Account" },
                { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
                { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
                { key: "balance", label: "Balance", render: (row) => `${money(row.balance)} ETB` },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                { key: "actions", label: "Actions", render: (row) => <div className="finance-actions"><button type="button" onClick={() => toast?.info?.(`${row.journal_no} - ${row.account}`)}>View Entry</button></div> },
              ]} rows={filteredLedgerRows} empty="No ledger rows match the current filters." />
            </section>
          </>
        )}

        {active === "journal" && (
          <section className="finance-panel">
            <div className="finance-panel-head">
              <h3>Journal Entries</h3>
              <span>Debit and credit postings by transaction</span>
            </div>
            <FinanceTable columns={[
              { key: "journal_no", label: "Journal No" },
              { key: "date", label: "Transaction Date" },
              { key: "account", label: "Account" },
              { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
              { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
              { key: "created_by", label: "Created By" },
              { key: "description", label: "Description" },
              { key: "posting_status", label: "Posting Status", render: (row) => <StatusBadge status={row.posting_status} /> },
            ]} rows={displayJournalRows} empty="No journal entries found." />
          </section>
        )}

        {active === "balances" && (
          <section className="finance-panel">
            <div className="finance-panel-head">
              <h3>Account Balances</h3>
              <span>Cash, revenue, refund liability, and receivables</span>
            </div>
            <FinanceTable columns={[
              { key: "account", label: "Account" },
              { key: "type", label: "Type" },
              { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
              { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
              { key: "balance", label: "Balance", render: (row) => `${money(row.balance)} ETB` },
            ]} rows={accountBalanceRows} />
          </section>
        )}

        {active === "trialBalance" && (
          <section className="finance-panel">
            <div className="finance-panel-head">
              <h3>Trial Balance</h3>
              <span>Total Debit = Total Credit</span>
            </div>
            <FinanceTable columns={[
              { key: "account", label: "Account" },
              { key: "debit", label: "Debit", render: (row) => `${money(row.debit)} ETB` },
              { key: "credit", label: "Credit", render: (row) => `${money(row.credit)} ETB` },
            ]} rows={accountBalanceRows} />
            <div className="finance-trial-footer">
              <div><span>Total Debit</span><strong>{money(trialDebit)} ETB</strong></div>
              <div><span>Total Credit</span><strong>{money(trialCredit)} ETB</strong></div>
              <div className={trialBalanced ? "ok" : "warn"}><span>Status</span><strong>{trialBalanced ? "Balanced" : "Review Required"}</strong></div>
            </div>
          </section>
        )}

        {active === "receipts" && (
          <>
            <section className="finance-receipt-preview finance-panel">
              <div className="finance-panel-head">
                <h3>Official Receipt Preview</h3>
                <span>Receipt Number - Declaration Number - Importer - Taxes - QR Code</span>
              </div>
              {receiptPreview ? (
                <div className="finance-receipt-card">
                  <div className="finance-receipt-main">
                    <div className="finance-receipt-title">
                      <strong>{receiptPreview.receipt_no || `RCPT-${String(receiptPreview.payment_id || "").slice(0, 8)}`}</strong>
                      <span>Ethiopian Import Management System</span>
                    </div>
                    <div className="finance-receipt-grid">
                      <div><span>Declaration Number</span><strong>{receiptPreview.declaration_no || String(receiptPreview.declaration_id || "-").slice(0, 8)}</strong></div>
                      <div><span>Importer Name</span><strong>{receiptPreview.importer_name || receiptPreview.company_name || "-"}</strong></div>
                      <div><span>Import Duty</span><strong>{money(receiptPreview.duty_paid)} ETB</strong></div>
                      <div><span>VAT</span><strong>{money(receiptPreview.vat_paid)} ETB</strong></div>
                      <div><span>Surtax</span><strong>{money(receiptPreview.surtax_paid)} ETB</strong></div>
                      <div><span>Payment Method</span><strong>{methodOf(receiptPreview)}</strong></div>
                      <div><span>Transaction ID</span><strong>{receiptPreview.transaction_id || receiptPreview.payment_order_no || "-"}</strong></div>
                      <div><span>Date</span><strong>{dateKey(paymentDate(receiptPreview)) || "-"}</strong></div>
                    </div>
                  </div>
                  <div className="finance-qr" aria-label="Receipt QR verification code">
                    {Array.from({ length: 49 }).map((_, index) => (
                      <i key={index} className={(index + String(receiptPreview.payment_id || "").charCodeAt(index % String(receiptPreview.payment_id || "").length || 0)) % 3 ? "" : "on"} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="finance-empty">No paid receipt is available for preview.</div>
              )}
            </section>
            <section className="finance-panel">
              <h3>Receipts Management</h3>
              <FinanceTable columns={receiptColumns} rows={paid} />
            </section>
          </>
        )}

        {active === "audit" && (
          <section className="finance-panel">
            <h3>Audit Trail</h3>
            <FinanceTable columns={[
              { key: "user", label: "User" },
              { key: "action", label: "Action" },
              { key: "declaration", label: "Declaration" },
              { key: "time", label: "Date" },
            ]} rows={auditRows} />
          </section>
        )}

        {active === "reports" && (
          <section className="finance-report-grid">
            {[ 
              ["Daily Revenue Report", "Total Revenue, transactions, and payment methods", paid],
              ["Monthly Revenue Report", "Revenue trend, top importers, and top HS codes", paid],
              ["Payment Method Report", `${METHODS.join(", ")} revenue`, paid],
              ["Clearance Revenue Report", "Revenue by customs office and risk channel", paid],
            ].map(([title, body, rows]) => (
              <div key={title} className="finance-panel">
                <h3>{title}</h3>
                <p>{body}</p>
                <button type="button" className="primary" onClick={() => csvDownload(`${title.toLowerCase().replace(/\s+/g, "-")}.csv`, rows)}>Download CSV</button>
              </div>
            ))}
          </section>
        )}
        </main>
      </div>
      </div>
    </div>
  );
}

