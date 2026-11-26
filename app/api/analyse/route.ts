import { NextRequest } from "next/server";
import { busFlags, FeedCopy, Fix, lagOfMyBus, median, missingCopies, RouteFile, whichBus } from "../../analysis";
import { Bus, database } from "../../nta";

// /api/analyse?ride=<id> analyses one ride on the server and saves it in "ride_analysis"
// (one document per ride, so many riders can be analysed at once)

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

  // 2. privacy (a2 promise): cut the first and last minute, near where people live or go
  const firstTime = Date.parse(allFixes[0].time);
  const lastTime = Date.parse(allFixes[allFixes.length - 1].time);
  const fixes = allFixes.filter((f) => Date.parse(f.time) > firstTime + 60_000 && Date.parse(f.time) < lastTime - 60_000);
  if (fixes.length < 10) {
    return Response.json({ error: "this ride is too short once the first and last minute are cut" }, { status: 400 });
  }
  const start = Date.parse(fixes[0].time);
  const end = Date.parse(fixes[fixes.length - 1].time);

  // 3. nta feed copies saved during the ride
  const feedDocs = await db.collection("nta_feed")
    .where("fetchedAt", ">=", new Date(start))
    .where("fetchedAt", "<=", new Date(end))
    .orderBy("fetchedAt")
    .get();
  const copies: FeedCopy[] = feedDocs.docs.map((d) => ({
    fetchedAt: d.data().fetchedAt.toMillis(),
    vehicles: (d.data().vehicles as Bus[]).filter((v) => v.route === route), // only my route
  }));

  // 4. which bus was i on?
  const mine = whichBus(fixes, copies, route);
  if (!mine) {
    const result = { rideId, route, copies: copies.length, myBus: null, note: "no bus of this route stayed next to me" };
    await db.collection("ride_analysis").doc(rideId).set(result);
    return Response.json(result);
  }

  // 5. its route line from the timetable files
  const myBus = copies.flatMap((c) => c.vehicles).find((v) => v.id === mine.id)!;
  // "/" -> "~" like prepare_gtfs.py, and old ids had spaces ("1 7A c a" -> "1_7A_c_a")
  const fileName = myBus.routeId.replaceAll("/", "~").replaceAll(" ", "_");
  const routeFile = (await (await fetch(`${request.nextUrl.origin}/gtfs/r/${encodeURIComponent(fileName)}.json`)).json()) as RouteFile;
  const line = routeFile.directions[String(myBus.direction)].shape;

  // 6. how far behind the nta was
  const lag = lagOfMyBus(fixes, copies, mine.id, line);

  // 7. flags for the other buses of my route
  const flagged: Record<string, string[]> = {}; // bus id -> its flags
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
