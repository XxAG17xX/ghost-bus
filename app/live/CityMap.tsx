"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colour, recolour, STYLE } from "../RideMap";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export type Frozen = { id: string; route: string; lat: number; lon: number; age: number };
export type Rider = { lat: number; lon: number; mode: string };

// all of dublin on the projector: every bus as a small amber dot,
// frozen buses as hollow rings (the ghosts), and people using the app as red dots
export default function CityMap({ buses, frozen, riders }: { buses: [number, number][]; frozen: Frozen[]; riders: Rider[] }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!,
      style: STYLE,
      center: [-6.27, 53.35],
      zoom: 10.6,
      interactive: false, // it's on a projector, nobody drags it
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      for (const id of ["nta", "ghosts", "riders"]) {
        map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      map.addLayer({ id: "nta", type: "circle", source: "nta", paint: { "circle-radius": 2.5, "circle-opacity": 0.55, "circle-stroke-width": 0 } });
      // a ghost is an empty ring, and the older its position, the bigger and fainter it gets
      map.addLayer({
        id: "ghosts",
        type: "circle",
        source: "ghosts",
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 2,
          "circle-radius": ["interpolate", ["linear"], ["get", "age"], 180, 6, 900, 14],
          "circle-stroke-opacity": ["interpolate", ["linear"], ["get", "age"], 180, 0.95, 900, 0.35],
        },
      });
      map.addLayer({ id: "riders", type: "circle", source: "riders", paint: { "circle-radius": 7, "circle-stroke-width": 2 } });
      recolour(map);
      map.setPaintProperty("ghosts", "circle-stroke-color", colour("--ink"));
      map.setPaintProperty("riders", "circle-color", colour("--signal"));
      map.setPaintProperty("riders", "circle-stroke-color", colour("--paper"));
      setReady(true);
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  // new numbers every 20 s: move all the dots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const points = (list: { coords: [number, number]; props?: object }[]) => ({
      type: "FeatureCollection" as const,
      features: list.map((p) => ({ type: "Feature" as const, properties: p.props ?? {}, geometry: { type: "Point" as const, coordinates: p.coords } })),
    });
    (map.getSource("nta") as maplibregl.GeoJSONSource).setData(points(buses.map((b) => ({ coords: b }))));
    (map.getSource("ghosts") as maplibregl.GeoJSONSource).setData(points(frozen.map((f) => ({ coords: [f.lon, f.lat], props: { age: f.age } }))));
    (map.getSource("riders") as maplibregl.GeoJSONSource).setData(points(riders.map((r) => ({ coords: [r.lon, r.lat] }))));
  }, [buses, frozen, riders, ready]);

  return <div ref={box} className="h-full w-full" role="img" aria-label="Map of Dublin with every bus, frozen buses as empty rings" />;
}
