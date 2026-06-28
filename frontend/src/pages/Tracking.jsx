import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShipmentsAPI } from "../api/shipmentAPI.js";
import { TrackingAPI } from "../api/trackingAPI.js";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LeafletMap from "../components/LeafletMap.jsx";
import "../styles/shipmentWizard.css";
function toRad(deg) {
  return (Number(deg) * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function statusText(streamStatus, t) {
  if (streamStatus === "live") return t("live");
  if (streamStatus === "connecting") return t("connecting");
  if (streamStatus === "disconnected") return t("disconnected");
  return t("idle");
}

function statusColor(streamStatus) {
  if (streamStatus === "live") return { background: "#e6ffed", color: "#137333", dot: "#16a34a" };
  if (streamStatus === "connecting") return { background: "#fef08a", color: "#3f2a00", dot: "#facc15" };
  if (streamStatus === "disconnected") return { background: "#fdecea", color: "#b00020", dot: "#dc2626" };
  return { background: "rgba(125, 166, 217, 0.14)", color: "#374151", dot: "#7da6d9" };
}

export default function Tracking() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();

  const [shipments, setShipments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [shipmentId, setShipmentId] = useState("");
  const [filter, setFilter] = useState("");

  const [snapshot, setSnapshot] = useState(null);
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [fitAllSeq, setFitAllSeq] = useState(0);
  const [streamCycle, setStreamCycle] = useState(0);

  const esRef = useRef(null);

  const reconnect = () => {
    if (!shipmentId) return;
    setStreamCycle((x) => x + 1);
  };

  const ports = useMemo(() => {
    if (Array.isArray(locations) && locations.length > 0) {
      const map = {};
      for (const loc of locations) {
        map[loc.name] = { lat: Number(loc.lat), lon: Number(loc.lon) };
      }
      return map;
    }
    return {
      "Djibouti Port": { lat: 11.6, lon: 43.15 },
      "Modjo Dry Port": { lat: 8.586, lon: 39.125 },
      "Kality Dry Port": { lat: 8.935, lon: 38.775 },
      "Dire Dawa Dry Port": { lat: 9.596, lon: 41.866 },
    };
  }, [locations]);

  const selectedShipment = useMemo(
    () => shipments.find((s) => String(s.shipment_id) === String(shipmentId)) || null,
    [shipments, shipmentId]
  );

  const filteredShipments = useMemo(() => {
    const q = String(filter || "").trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((s) =>
      String(s.shipment_reference || "").toLowerCase().includes(q) ||
      String(s.tracking_ref || "").toLowerCase().includes(q) ||
      String(s.company_name || "").toLowerCase().includes(q)
    );
  }, [shipments, filter]);

  const destination = useMemo(() => {
    const name = selectedShipment?.destination_port;
    if (!name) return null;
    return ports[name] || null;
  }, [selectedShipment, ports]);

  const origin = useMemo(() => {
    if (!trail || trail.length === 0) return null;
    return { lat: Number(trail[0].lat), lon: Number(trail[0].lon) };
  }, [trail]);

  const proximity = useMemo(() => {
    if (!snapshot?.lat || !snapshot?.lon || !destination) return null;
    const km = haversineKm({ lat: Number(snapshot.lat), lon: Number(snapshot.lon) }, destination);
    if (!Number.isFinite(km)) return null;
    return km;
  }, [snapshot?.lat, snapshot?.lon, destination]);

  const eta = useMemo(() => {
    if (!Number.isFinite(proximity)) return null;
    const speedKn = Number(snapshot?.speed);
    const speedKmh = Number.isFinite(speedKn) ? speedKn * 1.852 : NaN;
    if (!Number.isFinite(speedKmh) || speedKmh <= 1) return null;
    const hours = proximity / speedKmh;
    const etaDate = new Date(Date.now() + hours * 3600000);
    return etaDate;
  }, [proximity, snapshot?.speed]);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const [ships, locs] = await Promise.all([ShipmentsAPI.list(), TrackingAPI.locations()]);
      const rows = Array.isArray(ships) ? ships : [];
      setShipments(rows);
      setLocations(Array.isArray(locs) ? locs : []);

      if (!shipmentId && rows.length > 0) {
        setShipmentId(rows[0].shipment_id);
      }
    } catch (e) {
      toast?.error?.(e.message || t("failedToLoadTrackingRegistry"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
    return () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const sid = p.get("shipment_id") || "";
      if (sid) setShipmentId(sid);
    } catch {}
  }, [location.search]);

  useEffect(() => {
    if (!shipmentId) return;
    try {
      const p = new URLSearchParams(location.search);
      if (p.get("shipment_id") !== String(shipmentId)) {
        p.set("shipment_id", shipmentId);
        navigate(`/tracking?${p.toString()}`, { replace: true });
      }
    } catch {}
  }, [shipmentId, location.search, navigate]);

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

    const loadSnapshot = async () => {
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
      } catch (e) {
        toast?.error?.(e.message || t("failedToLoadShipmentTracking"));
      }
    };

    const connectStream = () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }

      try {
        setStreamStatus("connecting");
        const authRaw = localStorage.getItem("auth");
        const token = authRaw ? JSON.parse(authRaw)?.token : null;
        const base = import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api";
        const qp = token ? `?token=${encodeURIComponent(token)}` : "";
        const url = `${base}/tracking/${encodeURIComponent(shipmentId)}/stream${qp}`;

        const es = new EventSource(url, { withCredentials: false });
        es.onopen = () => setStreamStatus("live");

        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            setStreamStatus("live");
            setLastUpdateAt(Date.now());
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

    loadSnapshot();
    connectStream();

    const poll = setInterval(async () => {
      try {
        const snap = await TrackingAPI.get(shipmentId);
        if (cancelled) return;
        setSnapshot((prev) => ({ ...prev, ...snap }));
      } catch {}
    }, 12000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      setStreamStatus("disconnected");
    };
  }, [shipmentId, streamCycle, toast]);

  useEffect(() => {
    if (streamStatus !== "disconnected" || !shipmentId) return;
    const t = setTimeout(() => {
      reconnect();
    }, 7000);
    return () => clearTimeout(t);
  }, [streamStatus, shipmentId]);

  const badge = statusColor(streamStatus);

  return (
    <div className="eu-wizard">
      <div className="eu-head">
        <h2>{t("trackingOperationsCenter")}</h2>
        <div className="eu-sub">{t("trackingOpsSubtitle")}</div>
      </div>

      <div className="eu-card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
          <aside style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "rgba(7, 13, 24, 0.82)" }}>
            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>{t("shipmentQueue")}</div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("searchReferenceTrackingImporter")}
              style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", width: "100%", marginBottom: 10, background: "#fff", color: "#000" }}
            />

            <div style={{ display: "grid", gap: 6, maxHeight: 560, overflow: "auto" }}>
              {loading && <div style={{ color: "#6b7280" }}>{t("loadingShipments")}</div>}
              {!loading && filteredShipments.map((s) => {
                const active = String(s.shipment_id) === String(shipmentId);
                return (
                  <button
                    key={s.shipment_id}
                    type="button"
                    className="eu-btn"
                    onClick={() => setShipmentId(s.shipment_id)}
                    style={{
                      textAlign: "left",
                      borderColor: active ? "#2c65a5" : "#c5d3e2",
                      background: active ? "#eef5fd" : "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{s.shipment_reference || "-"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{s.company_name || "-"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{s.destination_port || t("noDestination")}</div>
                  </button>
                );
              })}
              {!loading && filteredShipments.length === 0 && <div style={{ color: "#6b7280" }}>{t("noShipmentsFound")}</div>}
            </div>
          </aside>

          <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            {!shipmentId && <div style={{ color: "#6b7280" }}>{t("selectShipmentLiveTracking")}</div>}

            {shipmentId && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{t("trackingReference")}</div>
                    <div style={{ fontWeight: 800, color: "#fff" }}>{selectedShipment?.tracking_ref || selectedShipment?.shipment_reference || "-"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        borderRadius: 999,
                        padding: "4px 10px",
                        background: badge.background,
                        color: badge.color,
                      }}
                      title={lastUpdateAt ? `${t("lastUpdate")}: ${new Date(lastUpdateAt).toLocaleString()}` : t("noStreamEventYet")}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: badge.dot }} />
                      {statusText(streamStatus, t)}
                    </span>
                    <button type="button" className="eu-btn" onClick={reconnect}>{t("reconnect")}</button>
                  </div>
                </div>

                <div className="eu-review" style={{ marginBottom: 10 }}>
                  <div className="eu-review-row"><span>{t("currentCoordinates")}</span><strong>{snapshot?.lat && snapshot?.lon ? `${Number(snapshot.lat).toFixed(5)}, ${Number(snapshot.lon).toFixed(5)}` : "N/A"}</strong></div>
                  <div className="eu-review-row"><span>{t("speed")}</span><strong>{snapshot?.speed != null ? `${Number(snapshot.speed).toFixed(1)} kn` : "-"}</strong></div>
                  <div className="eu-review-row"><span>{t("destination")}</span><strong>{selectedShipment?.destination_port || "-"}</strong></div>
                  <div className="eu-review-row"><span>{t("distanceToDestination")}</span><strong>{Number.isFinite(proximity) ? `${proximity.toFixed(1)} km` : "-"}</strong></div>
                  <div className="eu-review-row"><span>{t("estimatedArrival")}</span><strong>{eta ? eta.toLocaleString() : (snapshot?.eta_delivery ? new Date(snapshot.eta_delivery).toLocaleString() : "-")}</strong></div>
                </div>

                <LeafletMap
                  center={snapshot?.lat && snapshot?.lon ? { lat: Number(snapshot.lat), lon: Number(snapshot.lon) } : null}
                  trail={trail}
                  origin={origin}
                  destination={destination}
                  originName={selectedShipment?.origin_country || "Origin"}
                  destinationName={selectedShipment?.destination_port || t("destination")}
                  fitAllSeq={fitAllSeq}
                  height={420}
                />

                <div className="eu-nav" style={{ justifyContent: "space-between" }}>
                  <button type="button" className="eu-btn" onClick={() => setFitAllSeq((x) => x + 1)}>{t("fitRoute")}</button>
                  <button type="button" className="eu-btn" onClick={loadShipments}>{t("refreshRegistry")}</button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}






