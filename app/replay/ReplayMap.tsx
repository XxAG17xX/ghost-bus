"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLE } from "../RideMap";
import { paperColours } from "../live/CityMap";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

// the replay map: my trace so far (ink line), me (red dot), and where the nta said my bus was (empty ink ring),
// with the nta's older positions fading behind it. the camera follows me
export default function ReplayMap({ trace, me, nta }: { trace: [number, number][]; me: [number, number] | null; nta: [number, number][] }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({ container: box.current!, style: STYLE, center: [-6.26, 53.35], zoom: 15, interactive: false, attributionControl: { compact: true } });
    map.on("load", () => {
      for (const id of ["trace", "trail", "nta", "me"]) map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1c1a17", "line-width": 5 } });
      map.addLayer({ id: "trail", type: "circle", source: "trail", paint: { "circle-radius": 6, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2, "circle-stroke-color": "#1c1a17", "circle-stroke-opacity": 0.25 } });
      map.addLayer({ id: "me", type: "circle", source: "me", paint: { "circle-radius": 10, "circle-color": "#b3312a", "circle-stroke-width": 3, "circle-stroke-color": "#f4eedf" } });
      // the nta's claim goes on top, so it's never hidden under my dot
      map.addLayer({ id: "nta", type: "circle", source: "nta", paint: { "circle-radius": 16, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 4, "circle-stroke-color": "#1c1a17" } });
      paperColours(map);
      setReady(true);
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const points = (list: [number, number][]) => ({
      type: "FeatureCollection" as const,
      features: list.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: c } })),
    });
    (map.getSource("trace") as maplibregl.GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trace } });
    (map.getSource("me") as maplibregl.GeoJSONSource).setData(points(me ? [me] : []));
    (map.getSource("nta") as maplibregl.GeoJSONSource).setData(points(nta.slice(-1)));
    (map.getSource("trail") as maplibregl.GeoJSONSource).setData(points(nta.slice(0, -1)));
    if (me) map.jumpTo({ center: me });
  }, [trace, me, nta, ready]);

  return <div ref={box} className="h-full w-full" role="img" aria-label="Replay map: my real path in ink with a red dot, and the NTA's position for my bus as an empty ring" />;
}
