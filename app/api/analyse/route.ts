import { NextRequest } from "next/server";
import { busFlags, FeedCopy, Fix, lagOfMyBus, median, missingCopies, RouteFile, whichBus } from "../../analysis";
import { Bus, database } from "../../nta";

// /api/analyse?ride=<ride id> runs the analysis for one ride on vercel's server (the cloud part of task 1)
// and saves the result in "ride_analysis", so the app (and my report) can read it without doing the maths again.
// every rider's ride is its own document, so several people can ride and get analysed at the same time.

export async function GET(request: NextRequest) {
  const rideId = request.nextUrl.searchParams.get("ride") ?? "";
  if (rideId === "") {
    return Response.json({ error: "say which ride, like /api/analyse?ride=abc123" }, { status: 400 });
  }
  const db = database();

  // 1. the ride and its gps fixes
  const ride = await db.collection("rides").doc(rideId).get();
  if (!ride.exists) {
    return Response.json({ error: "no ride with that id" }, { status: 404 });
  }
  const route = String(ride.data()!.route);
  const allFixes = (await ride.ref.collection("points").orderBy("time").get()).docs.map((p) => p.data() as Fix);
  if (allFixes.length < 10) {
    return Response.json({ error: "this ride is too short to analyse" }, { status: 400 });
  }

  // 2. privacy (my promise from assignment 2): the first and last minute of a ride are cut before anything else,
  // because that's where people get on near their home or get off near where they're going
  const firstTime = Date.parse(allFixes[0].time);
  const lastTime = Date.parse(allFixes[allFixes.length - 1].time);
  const fixes = allFixes.filter((f) => Date.parse(f.time) > firstTime + 60_000 && Date.parse(f.time) < lastTime - 60_000);
  if (fixes.length < 10) {
    return Response.json({ error: "this ride is too short once the first and last minute are cut" }, { status: 400 });
  }
  const start = Date.parse(fixes[0].time);
  const end = Date.parse(fixes[fixes.length - 1].time);

  // 3. every copy of the nta feed saved while i was riding (by my own app or by the rush hour collector)
  const feedDocs = await db.collection("nta_feed")
    .where("fetchedAt", ">=", new Date(start))
    .where("fetchedAt", "<=", new Date(end))
    .orderBy("fetchedAt")
    .get();
  const copies: FeedCopy[] = feedDocs.docs.map((d) => ({
    fetchedAt: d.data().fetchedAt.toMillis(),
    vehicles: (d.data().vehicles as Bus[]).filter((v) => v.route === route), // only my route, the rest isn't needed here
  }));

  // 4. which bus was i on?
  const mine = whichBus(fixes, copies, route);
  if (!mine) {
    const result = { rideId, route, copies: copies.length, myBus: null, note: "no bus of this route stayed next to me" };
    await db.collection("ride_analysis").doc(rideId).set(result);
    return Response.json(result);
  }

  // 5. its route line, from the timetable files. the feed tells me its route id and direction
  const myBus = copies.flatMap((c) => c.vehicles).find((v) => v.id === mine.id)!;
  // same rule as prepare_gtfs.py for "/", and rides before 23 nov have the old ids with spaces ("1 7A c a" is now "1_7A_c_a")
  const fileName = myBus.routeId.replaceAll("/", "~").replaceAll(" ", "_");
  const routeFile = (await (await fetch(`${request.nextUrl.origin}/gtfs/r/${encodeURIComponent(fileName)}.json`)).json()) as RouteFile;
  const line = routeFile.directions[String(myBus.direction)].shape;

  // 6. how far behind the nta was about my bus
  const lag = lagOfMyBus(fixes, copies, mine.id, line);

  // 7. the other buses of my route while i rode: how often they were frozen or off their route
  const flagged: Record<string, string[]> = {}; // bus id -> every flag it got
  for (const copy of copies) {
    for (const bus of copy.vehicles) {
      for (const flag of busFlags(bus, copy.fetchedAt, routeFile)) {
        flagged[bus.id] = [...(flagged[bus.id] ?? []), flag];
      }
    }
  }
  const frozenBuses = Object.keys(flagged).filter((id) => flagged[id].includes("frozen"));

  const result = {
    rideId,
    route,
    routeId: myBus.routeId,
    direction: myBus.direction,
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    fixes: fixes.length,
    copies: copies.length,
    myBus: mine.id,
    timesTogether: mine.timesTogether,
    medianGap: Math.round(mine.medianGap ?? 0),
    missingCopies: missingCopies(copies, mine.id),
    medianAge: median(lag.map((r) => r.age)),
    maxAge: Math.max(...lag.map((r) => r.age)),
    medianBehind: median(lag.map((r) => r.behind)),
    maxBehind: Math.max(...lag.map((r) => r.behind)),
    frozenBuses: frozenBuses,
    lag: lag,
  };
  await db.collection("ride_analysis").doc(rideId).set(result);
  return Response.json(result);
}
