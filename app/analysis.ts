import type { Bus, Trip } from "./nta";

// the analysis (a4 task 1): my gps + the nta bus positions + the route lines from the timetable

export type Fix = { time: string; lat: number; lon: number; accuracy_m: number };
export type FeedCopy = { fetchedAt: number; vehicles: Bus[] }; // fetchedAt in ms
export type RouteFile = { id: string; name: string; directions: Record<string, { shape: [number, number][]; stops: string[] }> };

// older than 3 min = frozen (my buses on 26 nov sent a new position every 24 to 143 s)
export const FROZEN_SECONDS = 180;

// my fix has to be within 5 s of a moment to count
const FIX_WINDOW = 5;

// distance in metres (haversine, same as the app)
export function metres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

// middle value of a list
export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// A. snap a point onto the route line
// along = metres from the start of the route, off = metres away from the line
export function snap(line: [number, number][], lat: number, lon: number) {
  const metresPerDegreeLat = 111320;
  const metresPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);
  let best = { along: 0, off: Infinity };
  let travelled = 0; // metres of line so far

  for (let i = 0; i < line.length - 1; i++) {
    // one straight piece a -> b, in metres around my point
    const ax = (line[i][0] - lon) * metresPerDegreeLon;
    const ay = (line[i][1] - lat) * metresPerDegreeLat;
    const bx = (line[i + 1][0] - lon) * metresPerDegreeLon;
    const by = (line[i + 1][1] - lat) * metresPerDegreeLat;
    const length = Math.hypot(bx - ax, by - ay);

    // closest spot on the piece (0 = at a, 1 = at b)
    let share = 0;
    if (length > 0) {
      share = (-ax * (bx - ax) + -ay * (by - ay)) / (length * length);
      share = Math.max(0, Math.min(1, share));
    }
    const closestX = ax + share * (bx - ax);
    const closestY = ay + share * (by - ay);
    const off = Math.hypot(closestX, closestY); // my point is at 0,0

    if (off < best.off) {
      best = { along: travelled + share * length, off: off };
    }
    travelled += length;
  }
  return best;
}

// my fix closest to this time (unix seconds)
export function whereWasI(fixes: Fix[], seconds: number) {
  let best: Fix | null = null;
  let bestGap = Infinity;
  for (const fix of fixes) {
    const gap = Math.abs(Date.parse(fix.time) / 1000 - seconds);
    if (gap < bestGap) {
      best = fix;
      bestGap = gap;
    }
  }
  return bestGap <= FIX_WINDOW ? best : null;
}

// B. which bus am i on?
// the bus that was within 60 m of me (at its own sentAt) the most times.
// a bus going the other way can pass me once, but not copy after copy
export function whichBus(fixes: Fix[], copies: FeedCopy[], route: string) {
  const together: Record<string, number> = {}; // bus id -> times next to me
  const gaps: Record<string, number[]> = {}; // bus id -> distances
  for (const copy of copies) {
    for (const bus of copy.vehicles) {
      if (bus.route !== route) continue;
      const me = whereWasI(fixes, bus.sentAt);
      if (!me) continue;
      const distance = metres(me.lat, me.lon, bus.lat, bus.lon);
      if (distance < 60) {
        together[bus.id] = (together[bus.id] ?? 0) + 1;
        gaps[bus.id] = [...(gaps[bus.id] ?? []), distance];
      }
    }
  }

  let id: string | null = null;
  for (const busId in together) {
    if (id === null || together[busId] > together[id]) id = busId;
  }
  // at least 3 times (2 for very short rides)
  const needed = copies.length >= 6 ? 3 : 2;
  if (id === null || together[id] < needed) return null;
  return { id: id, timesTogether: together[id], medianGap: median(gaps[id]) };
}

// C. how far behind is the nta about my bus?
// age = seconds old when my app got it, behind = metres i was ahead along the route,
// error = metres between us when the bus sent it
export function lagOfMyBus(fixes: Fix[], copies: FeedCopy[], busId: string, line: [number, number][]) {
  const rows = [];
  for (const copy of copies) {
    const bus = copy.vehicles.find((v) => v.id === busId);
    if (!bus) continue;
    const meNow = whereWasI(fixes, copy.fetchedAt / 1000);
    const meThen = whereWasI(fixes, bus.sentAt);
    if (!meNow) continue;
    const busOnLine = snap(line, bus.lat, bus.lon);
    const meOnLine = snap(line, meNow.lat, meNow.lon);
    rows.push({
      at: copy.fetchedAt,
      sentAt: bus.sentAt,
      age: Math.round(copy.fetchedAt / 1000 - bus.sentAt),
      behind: Math.round(meOnLine.along - busOnLine.along),
      error: meThen ? Math.round(metres(meThen.lat, meThen.lon, bus.lat, bus.lon)) : null,
    });
  }
  return rows;
}

// copies my bus was missing from
export function missingCopies(copies: FeedCopy[], busId: string) {
  return copies.filter((copy) => !copy.vehicles.some((v) => v.id === busId)).length;
}

// D. flags for one bus: frozen (over 3 min old), off route (100 m+ from its line), no route (no line to check)
export function busFlags(bus: Bus, fetchedAt: number, routeFile: RouteFile | null) {
  const flags: string[] = [];
  const age = fetchedAt / 1000 - bus.sentAt;
  if (age > FROZEN_SECONDS) flags.push("frozen");

  const direction = routeFile && bus.direction !== null ? routeFile.directions[String(bus.direction)] : undefined;
  if (!direction) {
    flags.push("no route");
  } else if (snap(direction.shape, bus.lat, bus.lon).off > 100) {
    flags.push("off route");
  }
  return flags;
}

// ---------- the whole city right now (for the live screen) ----------

// dublin's buses: dublin bus ("1_...") and go-ahead ireland ("3_..."), old ids had a space instead of "_"
export function isDublinRoute(routeId: string) {
  return /^[13][ _]/.test(routeId);
}

// when a trip should have left (unix ms), from its start date and time. irish time is utc in winter
export function tripStart(trip: Trip) {
  const d = trip.startDate; // like "20261126"
  const [h, m, s] = trip.startTime.split(":").map(Number); // can be over 24, like "25:10:00" after midnight
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8))) + ((h * 60 + m) * 60 + s) * 1000;
}

// a trip "should be running" 5 min after its start plus its own predicted delay,
// and if no bus in the positions has that trip id, the board is showing a trip with no bus behind it
export function checkCity(vehicles: Bus[], vehiclesAt: number, trips: Trip[], tripsAt: number) {
  const dublinBuses = vehicles.filter((v) => isDublinRoute(v.routeId));
  const frozen = dublinBuses.filter((v) => vehiclesAt / 1000 - v.sentAt > FROZEN_SECONDS);

  const runningTrips = new Set(vehicles.map((v) => v.tripId));
  let shouldBeRunning = 0;
  const noBus: Trip[] = [];
  for (const trip of trips) {
    if (!isDublinRoute(trip.routeId) || trip.status === "CANCELED") continue;
    const due = tripStart(trip) + Math.max(trip.firstDelay ?? 0, 0) * 1000 + 5 * 60_000;
    if (tripsAt < due) continue; // not started yet
    shouldBeRunning++;
    if (!runningTrips.has(trip.tripId)) noBus.push(trip);
  }
  return { dublinBuses, frozen, shouldBeRunning, noBus };
}
