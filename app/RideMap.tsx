"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// the map draws in the background with this file, it gets copied into public/ when npm install runs
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

// free openstreetmap map tiles, no key needed. i recolour them below so they match my page
export const STYLE = "https://tiles.openfreemap.org/styles/positron";

// reads a colour from globals.css, so the map follows the page in light and dark mode
export function colour(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// paints the map in my own flat colours: land, water, parks, buildings, roads, labels
export function recolour(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    try {
      if (id.startsWith("poi")) {
        map.removeLayer(id); // shop and cafe icons are too busy on a bus
      } else if (id === "trace") {
        map.setPaintProperty(id, "line-color", colour("--route"));
      } else if (id === "me") {
        map.setPaintProperty(id, "circle-color", colour("--signal"));
        map.setPaintProperty(id, "circle-stroke-color", colour("--paper"));
      } else if (id === "mybus") {
        map.setPaintProperty(id, "circle-stroke-color", colour("--ink"));
      } else if (id === "official") {
        map.setPaintProperty(id, "line-color", colour("--map-route-line"));
      } else if (id === "nta") {
        map.setPaintProperty(id, "circle-color", colour("--amber")); // the nta's buses in the stop board's amber
        map.setPaintProperty(id, "circle-stroke-color", colour("--board"));
      } else if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", colour("--map-land"));
      } else if (layer.type === "fill" && id.includes("water")) {
        map.setPaintProperty(id, "fill-color", colour("--map-water"));
      } else if (layer.type === "fill" && (id.includes("park") || id.includes("wood") || id.includes("grass") || id.includes("landcover"))) {
        map.setPaintProperty(id, "fill-color", colour("--map-park"));
      } else if (layer.type === "fill" && id.includes("building")) {
        map.setPaintProperty(id, "fill-color", colour("--map-building"));
        map.setPaintProperty(id, "fill-outline-color", colour("--map-building"));
      } else if (layer.type === "fill") {
        map.setPaintProperty(id, "fill-color", colour("--map-land"));
      } else if (layer.type === "line" && id.includes("water")) {
        map.setPaintProperty(id, "line-color", colour("--map-water"));
      } else if (layer.type === "line" && !id.includes("boundary")) {
        map.setPaintProperty(id, "line-color", colour("--map-road"));
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", colour("--map-label"));
        map.setPaintProperty(id, "text-halo-color", colour("--map-land"));
      }
    } catch {
      // some layers don't have that colour, thats fine, they just stay as they are
    }
  }
}

// one live bus from the nta, as the recorder gives it to the map
type Bus = { id: string; route: string; lat: number; lon: number; sentAt: number; direction: number | null };

// shows my ride as a blue line, where i am now as a red dot, the nta's live buses of my route as amber dots
// (faded when their position is old), and the official route line in grey under everything.
// path is a list of [lon, lat], oldest first
// myBus is the bus i'm on (once the recorder has worked it out): it gets a ring drawn above my own dot,
// and buses going the other way fade out
export default function RideMap({ path, buses, route, myBus = null, myDirection = null }: { path: [number, number][]; buses: Bus[]; route: string; myBus?: string | null; myDirection?: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true); // the map follows me, until i move it myself
  const zoomedIn = useRef(false); // it zooms in on me once at the start, after that it keeps whatever zoom i pick

  // make the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!,
      style: STYLE,
      center: [-6.26, 53.345], // dublin, until the first fix comes
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      map.addSource("trace", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("me", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("nta", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("official", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      // the order here is the drawing order: the official line at the bottom, me on top
      map.addLayer({ id: "official", type: "line", source: "official", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 4 } });
      map.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 5 } });
      map.addLayer({
        id: "nta",
        type: "circle",
        source: "nta",
        paint: {
          "circle-radius": 7,
          "circle-stroke-width": 2,
          // older positions fade out: full under 2 minutes, half up to 10 minutes, faint after that
          // going the other way: faint
          "circle-opacity": ["case", ["==", ["get", "away"], 1], 0.2, ["step", ["get", "age"], 1, 120, 0.5, 600, 0.25]],
          "circle-stroke-opacity": ["case", ["==", ["get", "away"], 1], 0.2, ["step", ["get", "age"], 1, 120, 0.5, 600, 0.25]],
        },
      });
      map.addLayer({ id: "me", type: "circle", source: "me", paint: { "circle-radius": 8, "circle-stroke-width": 3 } });
      // my bus: an empty ring on top of everything, so it never hides under my own dot
      map.addLayer({
        id: "mybus",
        type: "circle",
        source: "nta",
        filter: ["==", ["get", "mine"], 1],
        paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3 },
      });
      recolour(map);
      setReady(true);
    });
    map.on("dragstart", () => setFollowing(false));

    // tap an amber bus to see its route, which bus it is and how old its position is right now.
    // the nta gives each bus a vehicle number (like 338), its not the route number on the front of the bus
    map.on("click", "nta", (e) => {
      const bus = e.features?.[0];
      if (!bus) return;
      const age = Date.now() / 1000 - (bus.properties.sentAt as number);
      const text = age < 60 ? `${Math.round(age)} s old` : `${Math.round(age / 60)} min old`;
      new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat(e.lngLat)
        .setText(`Route ${bus.properties.route} · vehicle ${bus.properties.id} · position ${text}`)
        .addTo(map);
    });
    map.on("mouseenter", "nta", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "nta", () => (map.getCanvas().style.cursor = ""));

    // when the phone goes into dark mode (like at night), repaint the map too
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const repaint = () => recolour(map);
    dark.addEventListener("change", repaint);

    mapRef.current = map;
    return () => {
      dark.removeEventListener("change", repaint);
      map.remove();
    };
  }, []);

  // every new fix: redraw the line and the dot, and move the map to me
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const last = path.at(-1);
    const trace = map.getSource("trace") as maplibregl.GeoJSONSource;
    trace.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } });
    const me = map.getSource("me") as maplibregl.GeoJSONSource;
    if (last) {
      me.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: last } });
    }
    if (path.length === 0) zoomedIn.current = false; // a new ride zooms in again
    if (last && following) {
      if (!zoomedIn.current) {
        map.easeTo({ center: last, zoom: 16, duration: 600 });
        zoomedIn.current = true;
      } else {
        map.easeTo({ center: last, duration: 600 }); // just slide along with me, keeping my zoom
      }
    }
  }, [path, ready, following]);

  // every new answer from the nta: move the amber dots, with how old each position is
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const nta = map.getSource("nta") as maplibregl.GeoJSONSource;
    nta.setData({
      type: "FeatureCollection",
      features: buses.map((bus) => ({
        type: "Feature",
        properties: {
          id: bus.id,
          route: bus.route,
          sentAt: bus.sentAt,
          age: Math.max(0, Date.now() / 1000 - bus.sentAt),
          mine: bus.id === myBus ? 1 : 0,
          away: myDirection !== null && bus.direction !== null && bus.direction !== myDirection ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: [bus.lon, bus.lat] },
      })),
    });
  }, [buses, ready, myBus, myDirection]);

  // the official line of my route, from the tfi timetable. only the 7A file exists for now (public/routes/7A.json)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const official = map.getSource("official") as maplibregl.GeoJSONSource;
    fetch(`/routes/${encodeURIComponent(route)}.json`)
      .then((response) => (response.ok ? response.json() : { type: "FeatureCollection", features: [] }))
      .then((line) => official.setData(line))
      .catch(() => official.setData({ type: "FeatureCollection", features: [] })); // no line, the map still works
  }, [route, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={box} className="h-full w-full" role="img" aria-label="Map of your ride" />
      {!following && path.length > 0 && (
        <button className="absolute right-2 top-2 bg-paper px-3 py-2 text-sm font-semibold text-ink" onClick={() => setFollowing(true)}>
          Follow me
        </button>
      )}
    </div>
  );
}
