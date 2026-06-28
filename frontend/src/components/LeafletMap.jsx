import React, { useEffect, useRef } from "react";

// Lightweight Leaflet loader via CDN to avoid bundler deps
function loadLeaflet(callback) {
  const have = window.L;
  if (have && window.L && window.L.map) { callback(); return; }
  const cssId = "leaflet-css";
  const jsId = "leaflet-js";
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId; link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  const done = () => callback();
  if (!document.getElementById(jsId)) {
    const script = document.createElement('script');
    script.id = jsId; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = done; document.body.appendChild(script);
  } else {
    done();
  }
}

export default function LeafletMap({ center, trail = [], origin = null, destination = null, originName = 'Origin', destinationName = 'Destination', height = 320, focusSeq = 0, fitSeq = 0, fitAllSeq = 0 }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const polyRealRef = useRef(null);
  const polyPredRef = useRef(null);
  const originRef = useRef(null);
  const destRef = useRef(null);
  const routeRef = useRef(null);

  useEffect(() => {
    loadLeaflet(() => {
      try {
        if (!divRef.current) return;
        if (!mapRef.current) {
          const L = window.L;
          const m = L.map(divRef.current).setView([center?.lat || 9.01, center?.lon || 38.75], 6);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(m);
          mapRef.current = m;
        }
        const L = window.L;
        if (center && isFinite(center.lat) && isFinite(center.lon)) {
          if (!markerRef.current) {
            markerRef.current = L.marker([center.lat, center.lon]).addTo(mapRef.current);
          } else {
            markerRef.current.setLatLng([center.lat, center.lon]);
          }
          mapRef.current.setView([center.lat, center.lon], Math.max(6, mapRef.current.getZoom()));
        }
        if (trail && trail.length > 0) {
          const real = trail.filter(p => !p.predicted).map(p => [p.lat, p.lon]);
          const pred = trail.filter(p => p.predicted).map(p => [p.lat, p.lon]);
          if (real.length) {
            if (!polyRealRef.current) polyRealRef.current = L.polyline(real, { color: '#0d6efd' }).addTo(mapRef.current);
            else polyRealRef.current.setLatLngs(real);
          }
          if (pred.length) {
            if (!polyPredRef.current) polyPredRef.current = L.polyline(pred, { color: '#6c757d', dashArray: '4, 6' }).addTo(mapRef.current);
            else polyPredRef.current.setLatLngs(pred);
          }
        }
        // Origin and destination markers
        if (origin && isFinite(origin.lat) && isFinite(origin.lon)) {
          if (!originRef.current) originRef.current = L.marker([origin.lat, origin.lon], { title: originName || 'Origin' }).addTo(mapRef.current).bindPopup(originName || 'Origin');
          else originRef.current.setLatLng([origin.lat, origin.lon]);
        }
        if (destination && isFinite(destination.lat) && isFinite(destination.lon)) {
          if (!destRef.current) destRef.current = L.marker([destination.lat, destination.lon], { title: destinationName || 'Destination' }).addTo(mapRef.current).bindPopup(destinationName || 'Destination');
          else destRef.current.setLatLng([destination.lat, destination.lon]);
        }
        // Route line from latest position to destination
        const latest = (trail && trail.length) ? trail[trail.length - 1] : center;
        if (latest && destination && isFinite(destination.lat) && isFinite(destination.lon)) {
          const routeCoords = [[latest.lat, latest.lon], [destination.lat, destination.lon]];
          if (!routeRef.current) {
            routeRef.current = L.polyline(routeCoords, { color: '#ff5722', dashArray: '6, 6' }).addTo(mapRef.current);
          } else {
            routeRef.current.setLatLngs(routeCoords);
          }
        }
      } catch {}
    });
    // no cleanup to keep map instance
  }, [center?.lat, center?.lon, trail?.length, origin?.lat, origin?.lon, destination?.lat, destination?.lon, focusSeq]);

  // Fit bounds to trail (and destination) on demand
  useEffect(() => {
    loadLeaflet(() => {
      try {
        if (!mapRef.current) return;
        const L = window.L;
        const coords = [];
        if (Array.isArray(trail) && trail.length) {
          for (const p of trail) { if (isFinite(p.lat) && isFinite(p.lon)) coords.push([p.lat, p.lon]); }
        }
        if (destination && isFinite(destination.lat) && isFinite(destination.lon)) coords.push([destination.lat, destination.lon]);
        if (coords.length >= 2) {
          const bounds = L.latLngBounds(coords);
          mapRef.current.fitBounds(bounds, { padding: [20,20] });
        }
      } catch {}
    });
  }, [fitSeq]);

  // Fit bounds to origin + entire trail + destination + center (if present)
  useEffect(() => {
    loadLeaflet(() => {
      try {
        if (!mapRef.current) return;
        const L = window.L;
        const coords = [];
        if (origin && isFinite(origin.lat) && isFinite(origin.lon)) coords.push([origin.lat, origin.lon]);
        if (Array.isArray(trail) && trail.length) {
          for (const p of trail) { if (isFinite(p.lat) && isFinite(p.lon)) coords.push([p.lat, p.lon]); }
        }
        if (destination && isFinite(destination.lat) && isFinite(destination.lon)) coords.push([destination.lat, destination.lon]);
        if (center && isFinite(center.lat) && isFinite(center.lon)) coords.push([center.lat, center.lon]);
        if (coords.length >= 2) {
          const bounds = L.latLngBounds(coords);
          mapRef.current.fitBounds(bounds, { padding: [30,30] });
        }
      } catch {}
    });
  }, [fitAllSeq]);

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}


