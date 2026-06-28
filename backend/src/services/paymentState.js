// Payment workflow state helpers
export const Status = Object.freeze({
  Pending: "Pending",
  Failed: "Failed",
  Verified: "Verified",
  Paid: "Paid",
});

export function allowedNext(s) {
  switch (s) {
    case Status.Pending:
      return [Status.Verified, Status.Failed];
    case Status.Failed:
      return [Status.Pending];
    case Status.Verified:
      return [Status.Paid];
    default:
      return [];
  }
}

export function assertTransition(current, desired) {
  if (!allowedNext(current).includes(desired)) {
    throw new Error(`Transition ${current} -> ${desired} not allowed`);
  }
}

export function verifyAcceptance(payment, bank, policy = { allowFx: false, minAmountRatio: 1.0 }) {
  if (!bank || !bank.receipt_no) return { ok: false, reason: "NO_MATCH" };
  const due = Number(payment.total_payable || 0);
  const paid = Number(bank.paid_amount || 0);
  const payCur = String(payment.currency || payment.declaration_currency || "");
  if (bank.currency && payCur && bank.currency !== payCur && !policy.allowFx) {
    return { ok: false, reason: "MISMATCH" };
  }
  if (!(paid >= due * (policy.minAmountRatio ?? 1.0))) {
    return { ok: false, reason: "INSUFFICIENT_AMOUNT" };
  }
  return { ok: true };
}
