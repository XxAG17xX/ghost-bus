import { NextRequest } from "next/server";
import { FROZEN_SECONDS, metres, tripStart } from "../../analysis";
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
    if (due < now - 60_000 || due > now + 60 * 60_000) continue; // only the next hour, like a real board

    // is there a real bus behind this line?
    const bus = vehicles.find((v) => v.tripId === trip.tripId);
    const started = now > tripStart(trip) + Math.max(trip.firstDelay ?? 0, 0) * 1000 + 5 * 60_000;
    let flag = "";
    if (trip.status === "CANCELED") flag = "cancelled";
    else if (!bus && started) flag = "no bus";
    else if (bus && fetchedAt / 1000 - bus.sentAt > FROZEN_SECONDS) flag = "frozen";

    rows.push({
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
