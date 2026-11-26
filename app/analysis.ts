import type { Bus } from "./nta";

// the analysis part of ghost bus (assignment 4, task 1). it puts three things together:
//   1. my phone's gps fixes (where the bus really was, because i'm sitting in it)
//   2. the nta's bus positions, saved about once a minute in "nta_feed"
//   3. the route line and stops from the tfi timetable (public/gtfs, made by scripts/prepare_gtfs.py)
// and answers: which bus am i on, how far behind is the nta about it, and which buses look like ghosts.
// everything here is plain maths on lists, no libraries, so it runs the same on vercel and on my laptop.

export type Fix = { time: string; lat: number; lon: number; accuracy_m: number };
export type FeedCopy = { fetchedAt: number; vehicles: Bus[] }; // fetchedAt in milliseconds, like Date.now()
export type RouteFile = { id: string; name: string; directions: Record<string, { shape: [number, number][]; stops: string[] }> };

// a bus position older than this is "frozen". on 26 nov my own buses sent a new position every 24 to 143 seconds,
// so a position over 3 minutes old means the bus missed at least one normal update
export const FROZEN_SECONDS = 180;

// a fix only counts as "where i was" at some moment if it's within this many seconds of it
const FIX_WINDOW = 5;

// the distance between two places in metres, along the earth's curve (the haversine formula, same as the app)
export function metres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

// the middle value of a list (half the values are below it), so one weird value doesn't pull it around like an average
export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// ---------- A. where along the route is a point? ----------
// the route line is a list of [lon, lat] corners. for every straight piece between two corners i find the
// closest spot on that piece to my point, and keep the piece where it's closest. that gives:
//   along = how many metres from the start of the route that spot is
//   off   = how far my point is from the line (a few metres normally, a lot if a bus is off its route)
// over a few hundred metres the earth is flat enough, so i turn degrees into metres with a simple scale
export function snap(line: [number, number][], lat: number, lon: number) {
  const metresPerDegreeLat = 111320;
  const metresPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);
  let best = { along: 0, off: Infinity };
  let travelled = 0; // metres of line before the piece i'm looking at

  for (let i = 0; i < line.length - 1; i++) {
    // the piece from corner a to corner b, with my point p, all in metres around p
    const ax = (line[i][0] - lon) * metresPerDegreeLon;
    const ay = (line[i][1] - lat) * metresPerDegreeLat;
    const bx = (line[i + 1][0] - lon) * metresPerDegreeLon;
    const by = (line[i + 1][1] - lat) * metresPerDegreeLat;
    const length = Math.hypot(bx - ax, by - ay);

    // how far along the piece the closest spot is, as a share from 0 (at a) to 1 (at b)
    let share = 0;
    if (length > 0) {
      share = (-ax * (bx - ax) + -ay * (by - ay)) / (length * length);
      share = Math.max(0, Math.min(1, share));
    }
    const closestX = ax + share * (bx - ax);
    const closestY = ay + share * (by - ay);
    const off = Math.hypot(closestX, closestY); // distance from p (which is at 0,0) to the closest spot

    if (off < best.off) {
      best = { along: travelled + share * length, off: off };
    }
    travelled += length;
  }
  return best;
}

// where was i at this moment (unix seconds)? the fix closest in time, if there is one within a few seconds
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

// ---------- B. which nta bus am i on? ----------
// for every copy of the feed, and every bus of my route in it, i check where *i* was at the moment that bus
// sent its position (its sentAt). if i'm on that bus, the two are basically the same place.
// the bus that's within 60 m of me the most times is my bus. a bus going the other way can pass right next to me
// once, but it can't stay next to me copy after copy, which is why i count and don't just take the closest
export function whichBus(fixes: Fix[], copies: FeedCopy[], route: string) {
  const together: Record<string, number> = {}; // bus id -> how many copies it was next to me
  const gaps: Record<string, number[]> = {}; // bus id -> the distances, for the median
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
  // three times together is my minimum, so a bus that just happened to pass me at a stop isn't picked.
  // a very short ride only has a few copies of the feed, so then two times is enough
  const needed = copies.length >= 6 ? 3 : 2;
  if (id === null || together[id] < needed) return null;
  return { id: id, timesTogether: together[id], medianGap: median(gaps[id]) };
}

// ---------- C. how far behind is the nta about my bus? ----------
// for every copy of the feed that has my bus, three numbers:
//   age    = how old its position was when my app got it (fetchedAt - sentAt), in seconds
//   behind = how many metres along the route i (the real bus) was ahead of where the nta said, at that moment.
//            this is what a person at a stop would have been shown, so it's the number that matters to them
//   error  = how far the nta position was from me at the moment the bus sent it (its own gps error, should be small)
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

// how many copies of the feed my bus was missing from, while i was riding it
export function missingCopies(copies: FeedCopy[], busId: string) {
  return copies.filter((copy) => !copy.vehicles.some((v) => v.id === busId)).length;
}

// ---------- D. which buses look wrong? ----------
// the flags one bus gets in one copy of the feed. a bus can have several, or none (that's a normal bus)
//   frozen    : its position is over 3 minutes old, but the feed still shows it like it's live
//   off route : it's more than 100 m from its own route line (wrong route id, a detour, or a bad position)
//   no route  : the feed doesn't say which way it's going, so it can't be checked against a line
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
