import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PaymentIntentAPI } from "../api/paymentIntentAPI.js";
import { useToast } from "../context/ToastContext.jsx";

const LABELS = {
  CBE: "CBE",
  TELEBIRR: "Telebirr",
  CHAPA: "Chapa",
};

export default function PaymentGateway() {
  const { provider = "", intentId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState(null);
  const upper = String(provider || "").toUpperCase();

  useEffect(() => {
    (async () => {
      try {
        const data = await PaymentIntentAPI.get(intentId);
        setIntent(data || null);
      } catch {
        setIntent(null);
      }
    })();
  }, [intentId]);

  const label = useMemo(() => LABELS[upper] || upper || "Payment", [upper]);

  const handleComplete = async () => {
    try {
      setBusy(true);
      await PaymentIntentAPI.mockSucceed(intentId, {
        receipt_no: `REC-${Date.now()}`,
        provider_ref: `${upper || "PROVIDER"}-${Date.now()}`,
      });
      toast?.success?.(`${label} payment completed`);
      navigate("/payments?created=1", { replace: true });
    } catch (e) {
      toast?.error?.(e.message || "Payment completion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="payments-page-shell">
      <div className="payments-page-panel">
        <div className="payments-page-section">
          <div className="payments-page-section-head">
            <div>
              <div className="payments-page-kicker">{label}</div>
              <h2 className="payments-page-title">{label} checkout</h2>
              <div className="payments-page-subtitle">
                This is the in-app fallback gateway used when a live provider URL is not configured.
              </div>
            </div>
          </div>

          <div className="payments-summary-grid" style={{ marginTop: 16 }}>
            <div className="payments-summary-card">
              <span className="payments-summary-label">Intent ID</span>
              <strong>{intentId || "-"}</strong>
            </div>
            <div className="payments-summary-card">
              <span className="payments-summary-label">Provider</span>
              <strong>{label}</strong>
            </div>
            <div className="payments-summary-card">
              <span className="payments-summary-label">Amount</span>
              <strong>{intent?.amount_etb ? Number(intent.amount_etb).toLocaleString() : "-"}</strong>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="eu-btn primary" onClick={handleComplete} disabled={busy}>
              {busy ? "Processing..." : `Complete ${label} payment`}
            </button>
            <button type="button" className="eu-btn" onClick={() => navigate("/payments")} disabled={busy}>
              Back to payments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
