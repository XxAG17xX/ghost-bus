import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { FROZEN_SECONDS, metres, RouteFile, snap } from "../../analysis";
import { Bus, database } from "../../nta";

// the extra task: "it didn't come". a report on its own is just an opinion, so the server checks it
// against the nta's own data and gives a verdict:
//   came     : a bus running this trip passed the stop (and when)
//   late     : a bus is running this trip, it just hasn't got here yet
//   unclear  : the bus running it has a frozen position, or the person wasn't at the stop
//   ghost    : no bus ran this trip at all, while the board kept showing it, and the person was at the stop
// the phone only sends how far it is from the stop, never where it is

const AT_STOP = 250; // metres, a phone closer than this counts as at the stop
const PASSED = 80; // metres, a bus this close to the stop passed it

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { stop, tripId, startDate, route, due, metresFromStop, demo } = body;
  if (!stop || !tripId) return Response.json({ error: "say which stop and trip" }, { status: 400 });

  const stops = await (await fetch(`${request.nextUrl.origin}/gtfs/stops.json`)).json();
  if (!stops[stop]) return Response.json({ error: "no stop with that id" }, { status: 404 });
  const [stopName, stopLat, stopLon] = stops[stop] as [string, number, number];

  // every saved copy of the bus positions from 20 minutes before the bus was due until now,
  // keeping only a bus that was running this trip
  const db = database();
  const now = Date.now();
  const copies = await db.collection("nta_feed").where("fetchedAt", ">=", new Date(due - 20 * 60_000)).orderBy("fetchedAt").get();
  const seen: { bus: Bus; at: number }[] = [];
  let another: Bus | null = null; // a later bus of the same route and direction that passed the stop (for the note only)
  for (const doc of copies.docs) {
    const vehicles = doc.data().vehicles as Bus[];
    const bus = vehicles.find((v) => v.tripId === tripId);
    if (bus) seen.push({ bus, at: doc.data().fetchedAt.toMillis() });
    for (const v of vehicles) {
      if (another || v.tripId === tripId || v.route !== route || v.direction !== body.direction) continue;
      if (v.sentAt * 1000 > due - 10 * 60_000 && metres(stopLat, stopLon, v.lat, v.lon) <= PASSED) another = v;
    }
  }

  // did it pass the stop? the closest it got, and when
  let closest: { bus: Bus; m: number } | null = null;
  for (const { bus } of seen) {
    const m = metres(stopLat, stopLon, bus.lat, bus.lon);
    if (!closest || m < closest.m) closest = { bus, m };
  }

  // the copies are about a minute apart, so a bus can pass the stop between two of them.
  // so i also check along its route line: if its newest position is further along than the stop, it went past
  let wentPast = false;
  if (seen.length > 0) {
    const latest = seen[seen.length - 1].bus;
    const file = latest.routeId.replaceAll("/", "~").replaceAll(" ", "_");
    const routeFile: RouteFile | null = await fetch(`${request.nextUrl.origin}/gtfs/r/${encodeURIComponent(file)}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const line = routeFile?.directions[String(latest.direction)]?.shape;
    if (line) {
      const stopOnLine = snap(line, stopLat, stopLon);
      const busOnLine = snap(line, latest.lat, latest.lon);
      wentPast = stopOnLine.off < 100 && busOnLine.along > stopOnLine.along + 50;
    }
  }

  // was someone using the app on the bus running this trip? if their phone passed the stop, it came
  let riderPassed: { busId: string; time: string } | null = null;
  const busIds = new Set(seen.map((s) => s.bus.id));
  if (busIds.size > 0) {
    const onBoard = await db.collection("live_riders").where("mode", "==", "bus").get();
    for (const r of onBoard.docs) {
      const rideId = r.data().rideId;
      if (!rideId || !busIds.has(r.data().busId) || riderPassed) continue;
      const points = await db.collection("rides").doc(rideId).collection("points")
        .where("time", ">=", new Date(due - 20 * 60_000).toISOString()).orderBy("time").get();
      for (const p of points.docs) {
        if (metres(stopLat, stopLon, p.data().lat, p.data().lon) <= PASSED) {
          riderPassed = { busId: r.data().busId, time: p.data().time };
          break;
        }
      }
    }
  }

  const atStop = demo === true || (typeof metresFromStop === "number" && metresFromStop <= AT_STOP);
  const time = (seconds: number) => new Date(seconds * 1000).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" });
  let verdict = "";
  let reason = "";
  if (riderPassed) {
    verdict = "came";
    reason = `Someone was on bus ${riderPassed.busId}. Their phone passed this stop at ${time(Date.parse(riderPassed.time) / 1000)}.`;
  } else if (closest && closest.m <= PASSED) {
    verdict = "came";
    reason = `Bus ${closest.bus.id} passed this stop at ${time(closest.bus.sentAt)}.`;
  } else if (wentPast) {
    const latest = seen[seen.length - 1].bus;
    verdict = "came";
    const age = Math.round(now / 1000 - latest.sentAt);
    reason = age > FROZEN_SECONDS
      ? `Bus ${latest.id} was already past this stop at ${time(latest.sentAt)}, its last position.`
      : `Bus ${latest.id} already went past this stop (seen at ${time(latest.sentAt)}).`;
  } else if (seen.length > 0) {
    const latest = seen[seen.length - 1];
    const age = Math.round(now / 1000 - latest.bus.sentAt);
    const away = Math.round(metres(stopLat, stopLon, latest.bus.lat, latest.bus.lon));
    if (age > FROZEN_SECONDS) {
      verdict = "unclear";
      reason = `Bus ${latest.bus.id} is on this trip, but its last position is ${Math.round(age / 60)} min old.`;
    } else {
      verdict = "late";
      reason = `Bus ${latest.bus.id} is running this trip, ${away < 1000 ? `${away} m` : `${(away / 1000).toFixed(1)} km`} away.`;
    }
  } else if (atStop) {
    verdict = "ghost";
    // a later bus of the same route doesn't save this line: it belongs to the next line on the board
    const next = another ? ` The next ${route} (bus ${another.id}) came at ${time(another.sentAt)}, but that one is the next line on the board.` : "";
    reason = `${body.cancelled ? "The NTA cancelled this trip, but the board kept it. " : ""}No bus ran this trip in the last ${Math.round((now - due) / 60_000) + 20} minutes, while the board kept showing it.${next}`;
  } else {
    verdict = "unclear";
    reason = "No bus ran this trip, but your phone wasn't at the stop, so this can't be confirmed.";
  }

  // other people who reported the same trip at the same stop
  const earlier = await db.collection("reports").where("stop", "==", stop).where("tripId", "==", tripId).get();
  // demo reports (classroom) and real ones are counted apart
  const witnesses = earlier.docs.filter((d) => d.data().demo === (demo === true)).length + 1;

  const report = {
    stop,
    stopName,
    stopLat,
    stopLon,
    tripId,
    startDate: startDate ?? "",
    route: route ?? "",
    due,
    metresFromStop: typeof metresFromStop === "number" ? Math.round(metresFromStop) : null,
    demo: demo === true,
    verdict,
    reason,
    witnesses,
    at: now,
    savedAt: FieldValue.serverTimestamp(),
  };
  await db.collection("reports").add(report);
  return Response.json(report);
}
