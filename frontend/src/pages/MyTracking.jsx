import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImporterTrackingAPI } from "../api/importerTrackingAPI.js";
import { TrackingAPI } from "../api/trackingAPI.js";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LeafletMap from "../components/LeafletMap.jsx";
import "../styles/shipmentWizard.css";
function streamTone(status, t) {
  if (status === "live") return { bg: "#e6ffed", color: "#137333", dot: "#16a34a", text: t("live") };
  if (status === "connecting") return { bg: "#fef08a", color: "#3f2a00", dot: "#facc15", text: t("connecting") };
  if (status === "disconnected") return { bg: "#fdecea", color: "#b00020", dot: "#dc2626", text: t("disconnected") };
  return { bg: "#e5e7eb", color: "#374151", dot: "#6b7280", text: t("idle") };
}

function timelineTone(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("completed") || s.includes("confirmed") || s.includes("cleared") || s.includes("transit")) {
    return { bg: "#e6ffed", color: "#137333" };
  }
  if (s.includes("progress")) {
    return { bg: "#fef08a", color: "#3f2a00" };
  }
  return { bg: "rgba(125, 166, 217, 0.16)", color: "#374151" };
}

export default function MyTracking() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [snapshot, setSnapshot] = useState(null);
  const [trail, setTrail] = useState([]);
  const [streamStatus, setStreamStatus] = useState("idle");
  const [lastEventAt, setLastEventAt] = useState(null);
  const [fitAllSeq, setFitAllSeq] = useState(0);
  const [streamCycle, setStreamCycle] = useState(0);

  const esRef = useRef(null);

  const doSearch = async (q) => {
    const v = String(q || "").trim();
    if (!v) {
      toast?.error?.(t("enterTrackingSearch"));
      return;
    }

    setSearching(true);
    try {
      const resp = await ImporterTrackingAPI.search(v);
      setResult(resp || null);
      try { localStorage.setItem("mytracking.lastQuery", v); } catch {}
    } catch (e) {
      setResult(null);
      toast?.error?.(e.message || t("searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await doSearch(query);
  };

  useEffect(() => {
    try {
      const last = localStorage.getItem("mytracking.lastQuery");
      if (last) {
        setQuery(last);
        doSearch(last);
      }
    } catch {}
  }, []);

  const shipmentId = result?.shipment?.shipment_id || "";

  const reconnect = () => {
    if (!shipmentId) return;
    setStreamCycle((x) => x + 1);
  };

  useEffect(() => {
    if (!shipmentId) {
      setSnapshot(null);
      setTrail([]);
      setStreamStatus("idle");
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const loadTracking = async () => {
      try {
        const [snap, tr] = await Promise.all([
          TrackingAPI.get(shipmentId),
          TrackingAPI.trail(shipmentId, 60),
        ]);
        if (cancelled) return;

        setSnapshot(snap || null);
        const pts = Array.isArray(tr)
          ? tr.slice().reverse().map((p) => ({
              lat: Number(p.lat),
              lon: Number(p.lon),
              t: new Date(p.seen_at).getTime(),
              predicted: !!p.predicted,
            }))
          : [];
        setTrail(pts);
      } catch {}
    };

    const connectStream = () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }

      try {
        setStreamStatus("connecting");
        const url = ImporterTrackingAPI.streamUrl(shipmentId);

        const es = new EventSource(url, { withCredentials: false });
        es.onopen = () => setStreamStatus("live");

        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            setStreamStatus("live");
            setLastEventAt(Date.now());
            setSnapshot((prev) => ({ ...prev, ...payload }));
            if (payload?.lat && payload?.lon) {
              setTrail((prev) => {
                const next = [
                  ...prev,
                  { lat: Number(payload.lat), lon: Number(payload.lon), t: Date.now(), predicted: !!payload.predicted },
                ];
                while (next.length > 80) next.shift();
                return next;
              });
            }
          } catch {}
        };

        es.onerror = () => {
          setStreamStatus("disconnected");
          try { es.close(); } catch {}
        };

        esRef.current = es;
      } catch {
        setStreamStatus("disconnected");
      }
    };

    loadTracking();
    connectStream();

    const pollTracking = setInterval(async () => {
      try {
        const snap = await TrackingAPI.get(shipmentId);
        if (cancelled) return;
        setSnapshot((prev) => ({ ...prev, ...snap }));
      } catch {}
    }, 15000);

    const pollTimeline = setInterval(async () => {
      try {
        if (!query.trim()) return;
        const resp = await ImporterTrackingAPI.search(query.trim());
        if (!cancelled) setResult(resp || null);
      } catch {}
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(pollTracking);
      clearInterval(pollTimeline);
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
    };
  }, [shipmentId, streamCycle]);

  useEffect(() => {
    if (streamStatus !== "disconnected" || !shipmentId) return;
    const t = setTimeout(() => reconnect(), 7000);
    return () => clearTimeout(t);
  }, [streamStatus, shipmentId]);

  const stream = streamTone(streamStatus, t);

  const mapCenter = useMemo(() => {
    if (!snapshot?.lat || !snapshot?.lon) return null;
    return { lat: Number(snapshot.lat), lon: Number(snapshot.lon) };
  }, [snapshot?.lat, snapshot?.lon]);

  const handleDownloadReleaseDocs = async () => {
    try {
      const declarationId = result?.declaration?.declaration_id;
      if (!declarationId) {
        toast?.error?.(t("declarationNotFoundForShipment"));
        return;
      }
      const blob = await ImporterTrackingAPI.downloadReleaseDocs(declarationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `release-docs-${result?.declaration?.declaration_no || declarationId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast?.success?.(t("releaseDocsDownloaded"));
    } catch (e) {
      toast?.error?.(e.message || t("releaseDocsNotReady"));
    }
  };

  return (
    <div className="eu-wizard">
      <div className="eu-head">
      </div>

      <form onSubmit={onSubmit} className="eu-card" style={{ marginTop: 12 }}>
        <h3>{t("searchShipment")}</h3>
        <p className="eu-help">{t("searchShipmentHelp")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px" }}
          />
          <button className="eu-btn primary" type="submit" disabled={searching}>{searching ? t("searching") : t("search")}</button>
        </div>
      </form>

      {!result && !searching && (
        <div className="eu-card" style={{ marginTop: 12 }}>
          <div style={{ color: "#6b7280" }}>{t("noShipmentSelectedHint")}</div>
        </div>
      )}

      {result && (
        <div className="eu-card" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 }}>
            <aside style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#f9fbfe" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{t("shipmentSummary")}</div>

              <div className="eu-review">
                <div className="eu-review-row"><span>{t("declarationNo")}</span><strong>{result.declaration?.declaration_no || "-"}</strong></div>
                <div className="eu-review-row"><span>{t("shipmentRef")}</span><strong>{result.shipment?.shipment_reference || "-"}</strong></div>
                <div className="eu-review-row"><span>{t("trackingReference")}</span><strong>{result.shipment?.tracking_ref || "-"}</strong></div>
                <div className="eu-review-row"><span>{t("coordinates")}</span><strong>{mapCenter ? `${mapCenter.lat.toFixed(5)}, ${mapCenter.lon.toFixed(5)}` : "N/A"}</strong></div>
              </div>

              {shipmentId && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      borderRadius: 999,
                      padding: "4px 10px",
                      background: stream.bg,
                      color: stream.color,
                    }}
                    title={lastEventAt ? `${t("lastUpdate")}: ${new Date(lastEventAt).toLocaleString()}` : t("noStreamEventYet")}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: stream.dot }} />
                    {stream.text}
                  </span>
                  <button type="button" className="eu-btn" onClick={reconnect}>{t("reconnect")}</button>
                </div>
              )}

              <div className="eu-nav" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                <button
                  type="button"
                  className="eu-btn"
                  onClick={() => {
                    try {
                      if (result.shipment?.shipment_id) {
                        localStorage.setItem("tracking.selectedShipmentId", result.shipment.shipment_id);
                      }
                    } catch {}
                    navigate(result.shipment?.shipment_id ? `/tracking?shipment_id=${encodeURIComponent(result.shipment.shipment_id)}` : "/tracking");
                  }}
                >
                  {t("openFullTracking")}
                </button>
                <button
                  type="button"
                  className="eu-btn"
                  onClick={() => navigate(result.declaration?.declaration_id ? `/payments?declaration_id=${encodeURIComponent(result.declaration.declaration_id)}` : "/payments")}
                >
                  {t("openPayments")}
                </button>
                <button
                  type="button"
                  className="eu-btn primary"
                  disabled={!result?.release_ready}
                  onClick={handleDownloadReleaseDocs}
                  title={result?.release_ready ? t("downloadReleaseDocsTitle") : t("completeRequirementsToDownload")}
                >
                  {t("downloadReleaseDocs")}
                </button>
              </div>
              {!result?.release_ready && result?.release_requirements && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                  {t("releaseDocsUnavailable")}
                  {!result.release_requirements.payment_ok ? ` ${t("paymentConfirmation")}` : ""}
                  {!result.release_requirements.inspection_ok ? ` ${t("inspectionReq")}` : ""}
                  {!result.release_requirements.clearance_ok ? ` ${t("clearanceReq")}` : ""}
                  {!result.release_requirements.docs_ok ? ` ${t("documentsReq")} (${(result.release_requirements.missing_docs || []).join(", ")});` : ""}
                </div>
              )}
            </aside>

            <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{t("statusTimeline")}</div>
              <div className="eu-timeline">
                {(Array.isArray(result.timeline) ? result.timeline : []).map((step) => {
                  const tone = timelineTone(step.status);
                  return (
                    <div key={step.key} className="eu-timeline-item" style={{ borderLeftColor: "#7ba8d8" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong>{step.icon} {step.title}</strong>
                        <span style={{ color: "#6b7280", fontSize: 13 }}>{step.description}</span>
                        {step.date && <span style={{ color: "#6b7280", fontSize: 12 }}>{t("date")}: {new Date(step.date).toLocaleDateString()}</span>}
                      </div>
                      <span style={{ alignSelf: "start", borderRadius: 999, fontSize: 11, padding: "3px 8px", background: tone.bg, color: tone.color }}>
                        {step.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{t("liveMap")}</div>
                <LeafletMap
                  center={mapCenter}
                  trail={trail}
                  height={360}
                  fitAllSeq={fitAllSeq}
                />
                <div className="eu-nav" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="eu-btn" onClick={() => setFitAllSeq((x) => x + 1)}>{t("fitRoute")}</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}







