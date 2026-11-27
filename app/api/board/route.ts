import { NextRequest } from "next/server";
import { FROZEN_SECONDS, metres, RouteFile, snap, tripStart } from "../../analysis";
import { database, latestTrips, latestVehicles, newestTrips } from "../../nta";

// /api/board?stop=<stop id>: what the real board at that stop would show, and what ghost bus thinks of each line.
// board time = timetable time at this stop + the nta's delay for the trip.
// it reads the timetable files from public/gtfs (made by scripts/prepare_gtfs.py and prepare_times.py)

type TimesFile = { stops: Record<string, [number, string][]>; trips: Record<string, [string, number[]]> };

// the timetable files are big, so each one is only downloaded once while the server is awake
const saved = new Map<string, unknown>();
async function file<T>(origin: string, path: string): Promise<T> {
  if (!saved.has(path)) {
    const response = await fetch(`${origin}/gtfs/${path}`);
    saved.set(path, response.ok ? await response.json() : null);
  }
  return saved.get(path) as T;
}

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get("stop") ?? "";
  const origin = request.nextUrl.origin;
  const stops = await file<Record<string, [string, number, number]>>(origin, "stops.json");
  const stopRoutes = await file<Record<string, string[]>>(origin, "stop_routes.json");
  if (!stops[stopId] || !stopRoutes[stopId]) {
    return Response.json({ error: "no dublin bus stop with that id" }, { status: 404 });
  }
  const [stopName, stopLat, stopLon] = stops[stopId];

  const db = database();
  const { vehicles } = await latestVehicles(db);
  if (process.env.NTA_KEY_TRIPS) {
    await latestTrips(db).catch((error) => console.error("trip updates not saved", error));
  }
  const { fetchedAt, trips } = await newestTrips(db);
  const now = Date.now();
  const routesHere = new Set(stopRoutes[stopId]);

  // riders on buses right now (seen in the last 2 minutes), by the nta bus they're on
  const riderDocs = await db.collection("live_riders").where("at", ">", now - 2 * 60_000).get();
  const riders = new Map<string, { lat: number; lon: number; at: number }>();
  for (const d of riderDocs.docs) {
    const r = d.data();
    if (r.mode === "bus" && r.busId) riders.set(r.busId, { lat: r.lat, lon: r.lon, at: r.at });
  }

  // "no bus came" answers from the last 2 hours, by trip, so the next person waiting for that bus sees them
  const recentNo = await db.collection("reports").where("at", ">", now - 2 * 3600_000).get();
  const saidNo = new Map<string, { count: number; stopName: string; at: number }>();
  for (const d of recentNo.docs) {
    const r = d.data();
    if (r.verdict !== "ghost") continue;
    const old = saidNo.get(r.tripId);
    saidNo.set(r.tripId, { count: (old?.count ?? 0) + 1, stopName: r.stopName, at: Math.max(old?.at ?? 0, r.at) });
  }

  const rows = [];
  for (const trip of trips) {
    if (!routesHere.has(trip.routeId)) continue;
    const times = await file<TimesFile>(origin, `t/${encodeURIComponent(trip.routeId.replaceAll("/", "~"))}.json`);
    const entry = times?.trips[trip.tripId];
    if (!entry) continue; // a trip the timetable doesn't know (it happens, the nta adds extra trips)
    const pattern = times.stops[entry[0]];
    const index = pattern.findIndex((p) => p[1] === stopId);
    if (index === -1) continue; // this trip doesn't stop here
    const sequence = pattern[index][0];

    // the delay that counts here: the last prediction at or before this stop (a delay carries on down the route)
    let delay = 0;
    const updates = (trip.updates ?? "").split(";").filter((u) => u !== "");
    for (const update of updates) {
      const [seq, value] = update.split(":").map(Number);
      if (seq <= sequence && !Number.isNaN(value)) delay = value;
    }
    if (delay === 0 && updates.length > 0 && Number(updates[0].split(":")[0]) > sequence) {
      delay = Number(updates[0].split(":")[1]) || 0; // all predictions are further on, so use the first one
    }

    const midnight = tripStart({ ...trip, startTime: "00:00:00" });
    const due = midnight + entry[1][index] * 1000 + delay * 1000;
    // the next hour like a real board, plus the last 10 minutes so people can say "it didn't come"
    if (due < now - 10 * 60_000 || due > now + 60 * 60_000) continue;

    // is there a real bus behind this line?
    const bus = vehicles.find((v) => v.tripId === trip.tripId);
    const started = now > tripStart(trip) + Math.max(trip.firstDelay ?? 0, 0) * 1000 + 5 * 60_000;
    let flag = "";
    if (trip.status === "CANCELED") flag = "cancelled";
    else if (!bus && started) flag = "no bus";
    else if (bus && fetchedAt / 1000 - bus.sentAt > FROZEN_SECONDS) flag = "frozen";

    // did the bus already go past this stop? compare both along the bus's own route line.
    // if a rider is on this bus, their phone says where it really is, so that's used instead of the nta
    let passed = false;
    let rider = null;
    if (bus) {
      const line = (await file<RouteFile>(origin, `r/${encodeURIComponent(bus.routeId.replaceAll("/", "~").replaceAll(" ", "_"))}.json`))?.directions[String(bus.direction)]?.shape;
      const onBoard = riders.get(bus.id);
      if (line) {
        const stopOnLine = snap(line, stopLat, stopLon);
        passed = stopOnLine.off < 100 && snap(line, bus.lat, bus.lon).along > stopOnLine.along + 50;
        if (onBoard) {
          rider = {
            metres: Math.round(metres(stopLat, stopLon, onBoard.lat, onBoard.lon)),
            age: Math.round((now - onBoard.at) / 1000),
            passed: stopOnLine.off < 100 && snap(line, onBoard.lat, onBoard.lon).along > stopOnLine.along + 50,
          };
        }
      }
    }

    rows.push({
      saidNo: saidNo.get(trip.tripId) ?? null,
      rider: rider,
      direction: trip.direction,
      passed: passed,
      tripId: trip.tripId,
      startDate: trip.startDate,
      route: trip.route,
      to: stops[pattern[pattern.length - 1][1]]?.[0] ?? "",
      due: due,
      vehicle: bus?.id ?? null,
      age: bus ? Math.round(now / 1000 - bus.sentAt) : null,
      metres: bus ? Math.round(metres(stopLat, stopLon, bus.lat, bus.lon)) : null,
      flag: flag,
    });
  }
  rows.sort((a, b) => a.due - b.due);

  return Response.json({ stop: { id: stopId, name: stopName, lat: stopLat, lon: stopLon }, tripsAt: fetchedAt, rows: rows });
}
