import { NextRequest } from "next/server";
import { Fix, whichBus } from "../../analysis";
import { Bus, database } from "../../nta";

// /api/replay?ride=<id>: everything the projector needs to play one real ride back:
// my gps trace (first and last minute cut, like the analysis) and every nta position of the bus i was on

export async function GET(request: NextRequest) {
  const rideId = request.nextUrl.searchParams.get("ride") ?? "";
  const db = database();
  const ride = await db.collection("rides").doc(rideId).get();
  if (!ride.exists) return Response.json({ error: "no ride with that id" }, { status: 404 });
  const route = String(ride.data()!.route);

  const all = (await ride.ref.collection("points").orderBy("time").get()).docs.map((p) => p.data() as Fix);
  const first = Date.parse(all[0].time);
  const last = Date.parse(all[all.length - 1].time);
  const fixes = all.filter((f) => Date.parse(f.time) > first + 60_000 && Date.parse(f.time) < last - 60_000);
  const start = Date.parse(fixes[0].time);
  const end = Date.parse(fixes[fixes.length - 1].time);

  const docs = await db.collection("nta_feed").where("fetchedAt", ">=", new Date(start)).where("fetchedAt", "<=", new Date(end)).orderBy("fetchedAt").get();
  const copies = docs.docs.map((d) => ({ fetchedAt: d.data().fetchedAt.toMillis() as number, vehicles: (d.data().vehicles as Bus[]).filter((v) => v.route === route) }));
  const mine = whichBus(fixes, copies, route);

  return Response.json({
    route,
    myBus: mine?.id ?? null,
    start,
    end,
    // [time in ms, lon, lat], one every 2 seconds is plenty for drawing
    fixes: fixes.filter((_, i) => i % 2 === 0).map((f) => [Date.parse(f.time), f.lon, f.lat]),
    // when my app got each copy, and where the nta said my bus was in it
    nta: copies
      .map((c) => ({ at: c.fetchedAt, bus: c.vehicles.find((v) => v.id === mine?.id) }))
      .filter((c) => c.bus)
      .map((c) => [c.at, c.bus!.lon, c.bus!.lat, c.bus!.sentAt]),
  });
}
