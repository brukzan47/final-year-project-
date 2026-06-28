import React, { Suspense } from "react";
import MapChoropleth from "./MapChoropleth.jsx";

// Lazy load react-simple-maps if installed. Fallback to bar map otherwise.
const LazyMap = React.lazy(async () => {
  try {
    const rsm = await import("react-simple-maps");
    return { default: rsmComposable(rsm) };
  } catch {
    return { default: () => null };
  }
});

function rsmComposable({ ComposableMap, Geographies, Geography }) {
  const MapComp = ({ data }) => {
    const values = Object.fromEntries((data || []).map(d => [d.country, Number(d.total_cif)||0]));
    const max = Math.max(1, ...Object.values(values));
    const colorFor = (v) => {
      const ratio = Math.min(1, v / max);
      const start = [227, 242, 253]; // #e3f2fd
      const end = [13, 110, 253]; // #0d6efd
      const rgb = start.map((s, i) => Math.round(s + (end[i]-s)*ratio));
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    };
    // Using an external TopoJSON source. Replace with a local file if needed.
    const geoUrl = "https://unpkg.com/world-atlas/world/110m.json";
    return (
      <ComposableMap projectionConfig={{ scale: 150 }} style={{ width: '100%', height: '260px' }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map(geo => {
              const name = geo.properties?.name;
              const v = values[name] || 0;
              return <Geography key={geo.rsmKey} geography={geo} fill={v ? colorFor(v) : "rgba(125, 166, 217, 0.16)"} stroke="#fff" strokeWidth={0.2} />;
            })
          }
        </Geographies>
      </ComposableMap>
    );
  };
  return MapComp;
}

export default function WorldMap({ data }) {
  return (
    <Suspense fallback={<MapChoropleth data={data} /> }>
      <LazyMap data={data} />
    </Suspense>
  );
}



