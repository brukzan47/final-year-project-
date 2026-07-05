import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PaymentsAPI } from "../api/paymentAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import "../styles/shipmentWizard.css";
import "../styles/payment.css";
import chapaLogo from "../assets/provider-chapa.svg";
import { PaymentIntentAPI } from "../api/paymentIntentAPI.js";

const PROVIDER_ICON_MAP = {
  CBE: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/CBE_SA.png/120px-CBE_SA.png",
  TELEBIRR: "https://ethiopianlogos.com/logos/tele_birr/tele_birr.png",
  CHAPA: chapaLogo,
};

function money(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Payment() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [busyProvider, setBusyProvider] = useState("");
  const [intentByPayment, setIntentByPayment] = useState({});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
  const [supportedProviders, setSupportedProviders] = useState([]);
  const pollRef = useRef(null);

  const isAdminRole = role === "Admin" || role === "Super Admin";
  const isSuperAdmin = role === "Super Admin";
  const canPay = role === "Importer" || role === "Finance Officer" || isAdminRole;
  const canVerify = role === "Finance Officer" || isSuperAdmin;
  const canApprove = role === "Finance Officer" || isSuperAdmin;
  const canViewFinanceSummary = role === "Finance Officer" || isAdminRole;

  const load = async () => {
    try {
      const data = await PaymentsAPI.list();
      const rows = Array.isArray(data) ? data : [];
      setItems(rows);
      if (canViewFinanceSummary) {
        try {
          setSummaryError("");
          setSummary(await PaymentsAPI.summary());
        } catch {
          setSummary(null);
          setSummaryError(t("financeSummaryUnavailable"));
        }
      }
      let declId = "";
      try {
        const p = new URLSearchParams(location.search);
        declId = p.get("declaration_id") || "";
      } catch {}
      if (declId) {
        const match = rows.find((x) => String(x.declaration_id) === String(declId));
        if (match) {
          setSelectedId(match.payment_id);
          return;
        }
      }
      if (!selectedId && rows.length) {
        const pending = rows.find((x) => String(x.payment_status) === "Pending");
        setSelectedId((pending || rows[0]).payment_id);
      }
    } catch (e) {
      toast?.error?.(e.message || t("failedToLoadPayments"));
    }
  };

  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      setShowCreatedBanner(p.get("created") === "1");
    } catch {
      setShowCreatedBanner(false);
    }
  }, [location.search]);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [location.search]);

  useEffect(() => {
    (async () => {
      try {
        const data = await PaymentIntentAPI.providers();
        setSupportedProviders(Array.isArray(data?.providers) ? data.providers : []);
      } catch {
        setSupportedProviders([]);
      }
    })();
  }, []);

  const providers = useMemo(() => {
    const rows = supportedProviders.length
      ? supportedProviders
      : [
          { key: "CBE", label: "CBE" },
          { key: "TELEBIRR", label: "Telebirr" },
          { key: "CHAPA", label: "Chapa" },
        ];
    return rows.map((item) => ({
      ...item,
      icon: item.icon || PROVIDER_ICON_MAP[String(item.key || "").toUpperCase()] || chapaLogo,
    }));
  }, [supportedProviders]);

  const isPlaceholderCheckoutUrl = (url) => {
    const value = String(url || "").toLowerCase();
    return value.includes("apps.cbe.com.et") || value.includes("telebirr.et") || value.includes("checkout.chapa.co");
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    return items.filter((x) => String(x.payment_status) === statusFilter);
  }, [items, statusFilter]);

  const localSummary = useMemo(() => {
    const base = {
      total_count: items.length,
      pending_count: 0,
      verified_count: 0,
      paid_count: 0,
      failed_count: 0,
      assessed_amount: 0,
      total_revenue: 0,
      pending_amount: 0,
      verified_amount: 0,
      failed_amount: 0,
      outstanding_amount: 0,
    };
    items.forEach((item) => {
      const status = String(item.payment_status || "Pending");
      const parsedAmount = Number(item.total_payable || 0);
      const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
      base.assessed_amount += amount;
      if (status === "Pending") {
        base.pending_count += 1;
        base.pending_amount += amount;
        base.outstanding_amount += amount;
      } else if (status === "Verified") {
        base.verified_count += 1;
        base.verified_amount += amount;
        base.outstanding_amount += amount;
      } else if (status === "Paid") {
        base.paid_count += 1;
        base.total_revenue += amount;
      } else if (status === "Failed") {
        base.failed_count += 1;
        base.failed_amount += amount;
      }
    });
    return base;
  }, [items]);

  const financeSummary = summary || localSummary;

  const countForStatus = (status) => {
    if (status === "ALL") return Number(financeSummary.total_count || 0);
    const key = `${status.toLowerCase()}_count`;
    return Number(financeSummary[key] || 0);
  };

  const selected = useMemo(
    () => items.find((x) => String(x.payment_id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const effectiveStatus = useMemo(() => {
    if (!selected) return "Pending";
    const pendingIntent = intentByPayment[selected.payment_id];
    if (pendingIntent && String(selected.payment_status) === "Pending") return "Initiated";
    return String(selected.payment_status || "Pending");
  }, [selected, intentByPayment]);

  const startPolling = (paymentId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const current = await PaymentsAPI.getStatus(paymentId);
        if (String(current?.payment_status) === "Paid") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIntentByPayment((prev) => {
            const next = { ...prev };
            delete next[paymentId];
            return next;
          });
          toast?.success?.(t("paymentCompletedApproved"));
          await load();
        }
      } catch {}
    }, 5000);
  };

  const handlePay = async (provider) => {
    if (!selected) return;
    try {
      setBusyProvider(provider);
      const res = await PaymentsAPI.initiate(selected.payment_id, provider);
      setIntentByPayment((prev) => ({ ...prev, [selected.payment_id]: { provider, intent_id: res?.intent_id || "" } }));
      toast?.success?.(`${provider} ${t("paymentInitiatedToast")}`);
      startPolling(selected.payment_id);
      if (res?.checkout_url && !isPlaceholderCheckoutUrl(res.checkout_url)) {
        window.location.href = res.checkout_url;
      } else if (res?.intent_id) {
        navigate(`/payment-gateway/${encodeURIComponent(provider)}/${encodeURIComponent(res.intent_id)}`);
      }
    } catch (e) {
      toast?.error?.(e.message || t("paymentInitiationFailed"));
    } finally {
      setBusyProvider("");
    }
  };

  const handleVerify = async () => {
    if (!selected) return;
    try {
      await PaymentsAPI.verify(selected.payment_id);
      toast?.success?.(t("paymentVerified"));
      await load();
    } catch (e) {
      toast?.error?.(e.message || t("verificationFailed"));
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    try {
      await PaymentsAPI.approve(selected.payment_id);
      toast?.success?.(t("paymentApproved"));
      await load();
    } catch (e) {
      toast?.error?.(e.message || t("approvalFailed"));
    }
  };

  const handleRetry = async () => {
    if (!selected) return;
    try {
      await PaymentsAPI.reverify(selected.payment_id);
      toast?.success?.(t("paymentResetPending"));
      await load();
    } catch (e) {
      toast?.error?.(e.message || t("retryFailed"));
    }
  };

  const handleReceipt = async () => {
    if (!selected) return;
    try {
      const blob = await PaymentsAPI.downloadReceipt(selected.payment_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${selected.payment_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast?.error?.(e.message || t("failedToDownloadReceipt"));
    }
  };

  return (
    <div className="payments-page-shell">
      <div className="payments-page-panel">
        <div className="payments-page-section payments-page-section--head">
          <div className="payments-page-section-head">
            <div>
              <div className="payments-page-kicker">{t("paymentControlBoard")}</div>
              <h2 className="payments-page-title">{t("paymentControlBoard")}</h2>
              <div className="payments-page-subtitle">{t("financeWorkflowSubtitle")}</div>
            </div>
          </div>
        </div>

        {showCreatedBanner && (
          <div className="payments-page-banner">
            <div style={{ color: "#137333", fontWeight: 600 }}>
              {t("declarationSubmittedPendingPayment")}
            </div>
            <button type="button" className="eu-btn" onClick={() => setShowCreatedBanner(false)}>{t("dismiss")}</button>
          </div>
        )}

        {canViewFinanceSummary && (
          <div className="payments-page-section payments-page-section--summary" aria-label={t("paymentControlBoard")}>
            <div className="finance-summary-grid">
              <div className="finance-summary-card">
                <span>{t("totalRevenue")}</span>
                <strong>{money(financeSummary.total_revenue)} ETB</strong>
              </div>
              <div className="finance-summary-card">
                <span>{t("outstandingAmount")}</span>
                <strong>{money(financeSummary.outstanding_amount)} ETB</strong>
              </div>
              <div className="finance-summary-card">
                <span>{t("pendingReview")}</span>
                <strong>{Number(financeSummary.pending_count || 0)}</strong>
              </div>
              <div className="finance-summary-card">
                <span>{t("readyForApproval")}</span>
                <strong>{Number(financeSummary.verified_count || 0)}</strong>
              </div>
              {summaryError && <div className="finance-summary-error">{summaryError}</div>}
            </div>
          </div>
        )}

        <div className="payments-page-section payments-page-section--content">
          <div className="payment-layout">
            <aside className="payment-queue">
              <div className="payments-page-subsection-title">{t("paymentQueue")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {["ALL", "Pending", "Verified", "Paid", "Failed"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`eu-btn ${statusFilter === s ? "primary" : ""}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "ALL" ? t("all") : s} ({countForStatus(s)})
                  </button>
                ))}
              </div>

              <div className="payment-queue-list">
                {filteredItems.map((p) => {
                  const active = String(p.payment_id) === String(selectedId);
                  return (
                    <button
                      key={p.payment_id}
                      type="button"
                      className="eu-btn"
                      onClick={() => setSelectedId(p.payment_id)}
                      style={{
                        textAlign: "left",
                        borderColor: active ? "#2c65a5" : "#c5d3e2",
                        background: active ? "#eef5fd" : "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{p.declaration_no || p.declaration_id}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{money(p.total_payable)} ETB</div>
                      <span style={{ display: "inline-block", marginTop: 4 }}><StatusBadge status={p.payment_status || "Pending"} /></span>
                    </button>
                  );
                })}
                {filteredItems.length === 0 && <div style={{ color: "#6b7280" }}>{t("noPaymentRecords")}</div>}
              </div>
            </aside>

            <section className="payment-details">
              {!selected && <div style={{ color: "#6b7280" }}>{t("selectPaymentFromQueue")}</div>}

              {selected && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>{t("declaration")}</div>
                      <div style={{ fontWeight: 800, color: "#12335a" }}>{selected.declaration_no || selected.declaration_id}</div>
                    </div>
                    <StatusBadge status={effectiveStatus} />
                  </div>

                  <div className="eu-review">
                    <div className="eu-review-row"><span>{t("totalPayable")}</span><strong>{money(selected.total_payable)} ETB</strong></div>
                    <div className="eu-review-row"><span>{t("paymentMethod")}</span><strong>{selected.payment_method || "-"}</strong></div>
                    <div className="eu-review-row"><span>{t("orderNumber")}</span><strong>{selected.payment_order_no || "-"}</strong></div>
                    <div className="eu-review-row"><span>{t("receiptNumber")}</span><strong>{selected.receipt_no || "-"}</strong></div>
                  </div>

                  <div className="eu-status-panel">
                    <h4>{t("workflowTimeline")}</h4>
                    <div className="eu-timeline">
                      <div className="eu-timeline-item"><span>1. {t("paymentCreated")}</span><strong>{selected.payment_id ? t("done") : "-"}</strong></div>
                      <div className="eu-timeline-item"><span>2. {t("paymentInitiated")}</span><strong>{effectiveStatus === "Initiated" || selected.payment_method ? t("done") : t("pendingWord")}</strong></div>
                      <div className="eu-timeline-item"><span>3. {t("verified")}</span><strong>{String(selected.payment_status) === "Verified" || String(selected.payment_status) === "Paid" ? t("done") : t("pendingWord")}</strong></div>
                      <div className="eu-timeline-item"><span>4. {t("approvedPaid")}</span><strong>{String(selected.payment_status) === "Paid" ? t("done") : t("pendingWord")}</strong></div>
                    </div>
                  </div>

                  {String(selected.payment_status) === "Pending" && canPay && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>{t("initiatePayment")}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {providers.map((provider) => (
                          <button
                            key={provider.key}
                            className="eu-btn primary payment-provider-btn"
                            onClick={() => handlePay(provider.key)}
                            disabled={Boolean(busyProvider)}
                          >
                            <span className="pay-btn-content">
                              <img src={provider.icon} alt="" className="provider-icon" />
                              <span>{busyProvider === provider.key ? t("processing") : provider.label}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="eu-nav" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                    {String(selected.payment_status) === "Pending" && canVerify && (
                      <button className="eu-btn" onClick={handleVerify}>{t("markVerified")}</button>
                    )}
                    {String(selected.payment_status) === "Verified" && canApprove && (
                      <button className="eu-btn primary" onClick={handleApprove}>{t("approvePayment")}</button>
                    )}
                    {String(selected.payment_status) === "Failed" && canVerify && (
                      <button className="eu-btn" onClick={handleRetry}>{t("retryPayment")}</button>
                    )}
                    {String(selected.payment_status) === "Paid" && (
                      <button className="eu-btn primary" onClick={handleReceipt}>{t("downloadReceipt")}</button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}





