"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLE } from "../RideMap";
import { metres } from "../analysis";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export type Frozen = { id: string; route: string; lat: number; lon: number; age: number };
export type Rider = { lat: number; lon: number; mode: string };

// a hand drawn circle, like someone ringed the bus with a red marker
const RING = `<svg class="red-ring" viewBox="0 0 44 44"><path d="M8 18 C9 7, 33 3, 38 17 C42 30, 25 41, 13 36 C4 32, 3 22, 11 12" /></svg>`;

// the map looks like a paper print: light paper, ink roads, ink labels
export function paperColours(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    try {
      // shop icons, house numbers and road numbers (L1562...) clutter the print
      const label = JSON.stringify((layer as { layout?: Record<string, unknown> }).layout?.["text-field"] ?? "");
      if (id.startsWith("poi") || id.includes("housenum") || id.includes("shield") || label.includes("ref")) map.removeLayer(id);
      else if (layer.type === "background") map.setPaintProperty(id, "background-color", "#f1ead8");
      else if (layer.type === "fill" && id.includes("water")) map.setPaintProperty(id, "fill-color", "#d9dedb");
      else if (layer.type === "fill") map.setPaintProperty(id, "fill-color", "#ebe3cf");
      else if (layer.type === "line" && id.includes("water")) map.setPaintProperty(id, "line-color", "#c9d0cc");
      else if (layer.type === "line" && !id.includes("boundary")) map.setPaintProperty(id, "line-color", "#cfc5ad");
      else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", "#5a5246");
        map.setPaintProperty(id, "text-halo-color", "#f1ead8");
      }
    } catch {
      // some layers don't have that colour, fine
    }
  }
}

// exhibit a: every dublin bus as an ink dot, frozen buses ringed in red,
// the three oldest get an exhibit tag, and riders are blue ink dots
export default function CityMap({ buses, frozen, riders }: { buses: [number, number][]; frozen: Frozen[]; riders: Rider[] }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rings = useRef(new Map<string, maplibregl.Marker>()); // bus id -> its red ring
  const tags = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!,
      style: STYLE,
      center: [-6.27, 53.345],
      zoom: 10.7,
      // i drive it from my laptop in the demo, so it can be dragged and zoomed
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      map.addSource("nta", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("riders", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "nta", type: "circle", source: "nta", paint: { "circle-radius": 2.6, "circle-color": "#1c1a17", "circle-opacity": 0.75 } });
      map.addLayer({
        id: "riders",
        type: "circle",
        source: "riders",
        paint: { "circle-radius": 8, "circle-color": "#2438a8", "circle-stroke-width": 2.5, "circle-stroke-color": "#f4eedf" },
      });
      paperColours(map);
      setReady(true);
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const points = (coords: [number, number][]) => ({
      type: "FeatureCollection" as const,
      features: coords.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: c } })),
    });
    (map.getSource("nta") as maplibregl.GeoJSONSource).setData(points(buses));
    (map.getSource("riders") as maplibregl.GeoJSONSource).setData(points(riders.map((r) => [r.lon, r.lat])));

    // red rings: keep the ones still frozen, draw new ones, remove buses that sent a new position
    const stillFrozen = new Set(frozen.map((f) => f.id));
    for (const [id, marker] of rings.current) {
      if (!stillFrozen.has(id)) {
        marker.remove();
        rings.current.delete(id);
      }
    }
    const firstTime = rings.current.size === 0; // on the first load all rings appear at once, no drawing
    for (const bus of frozen) {
      const old = rings.current.get(bus.id);
      if (old) {
        old.setLngLat([bus.lon, bus.lat]);
        continue;
      }
      const element = document.createElement("div");
      element.innerHTML = RING;
      if (!firstTime) element.firstElementChild!.classList.add("new"); // a newly frozen bus gets its ring drawn
      rings.current.set(bus.id, new maplibregl.Marker({ element }).setLngLat([bus.lon, bus.lat]).addTo(map));
    }

    // exhibit tags on the three oldest positions
    for (const tag of tags.current) tag.remove();
    const view = map.getBounds(); // only buses you can actually see on the map get a tag
    // the three oldest, but never two within 1.5 km of each other, so the tags don't sit on top of each other
    const oldest: Frozen[] = [];
    for (const bus of frozen.filter((f) => view.contains([f.lon, f.lat])).sort((a, b) => b.age - a.age)) {
      if (oldest.length === 3) break;
      if (oldest.every((o) => metres(o.lat, o.lon, bus.lat, bus.lon) > 1500)) oldest.push(bus);
    }
    tags.current = oldest.map((bus) => {
      const element = document.createElement("div");
      element.className = "exhibit-tag";
      element.innerHTML = `<i></i><span>${bus.route || "?"} · ${Math.round(bus.age / 60)} MIN OLD</span>`;
      return new maplibregl.Marker({ element, anchor: "left", offset: [14, 0] }).setLngLat([bus.lon, bus.lat]).addTo(map);
    });
  }, [buses, frozen, riders, ready]);

  return <div ref={box} className="h-full w-full" role="img" aria-label="Map of Dublin: every bus on the NTA feed as a dot, buses with a position over 3 minutes old ringed in red" />;
}
