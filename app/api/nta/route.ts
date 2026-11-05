import { NextRequest } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// this file runs on vercel's server, not on the phone, so the nta key and the firebase server key stay secret.
// the phone calls /api/nta?route=7A every 15 s while it's recording, but this only goes to the nta once a minute.

// the nta's live bus positions (GTFS-Realtime), as json
const FEED = "https://api.nationaltransport.ie/gtfsr/v2/Vehicles?format=json";

// my live site, which has both keys
const LIVE = "https://ghost-bus-a3.vercel.app/api/nta";

// one bus from the feed, the way i save it
type Bus = {
  id: string; // the bus's own number
  route: string; // "7A"
  routeId: string; // how the feed names the route, like "1 7A c a"
  tripId: string;
  direction: number | null;
  lat: number;
  lon: number;
  sentAt: number; // when the bus sent this position (unix seconds), so i can see how old it is
};

export async function GET(request: NextRequest) {
  const route = (request.nextUrl.searchParams.get("route") ?? "").toUpperCase();
  if (route === "") {
    return Response.json({ error: "say which route, like /api/nta?route=7A" }, { status: 400 });
  }

  // no keys on this computer (like someone running my code from the zip), so i ask my live site instead, it has the keys.
  // my keys never leave vercel, and only my live site ever calls the nta. on vercel the keys are always there,
  // and the VERCEL check makes sure the live site can never end up asking itself
  if (!process.env.NTA_KEY && !process.env.VERCEL) {
    const live = await fetch(`${LIVE}?route=${encodeURIComponent(route)}`, { cache: "no-store" });
    return Response.json(await live.json(), { status: live.status });
  }

  // firebase admin is the server version of firebase. it can write to the database without the phone rules
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  const db = getFirestore();

  // the nta only allows one call a minute, so if the feed was fetched less than 60 s ago, i reuse that one
  // shortcut: two phones asking at the exact same moment could both fetch, fine for a few riders, fix it with a transaction in A4
  const latest = await db.collection("nta_feed").orderBy("fetchedAt", "desc").limit(1).get();
  if (!latest.empty) {
    const saved = latest.docs[0].data();
    const age = Date.now() - saved.fetchedAt.toMillis();
    if (age < 60_000) {
      return Response.json(answer(route, saved.vehicles, saved.fetchedAt.toMillis()));
    }
  }

  // ask the nta for every bus in ireland right now
  const response = await fetch(FEED, { headers: { "x-api-key": process.env.NTA_KEY! }, cache: "no-store" });
  if (!response.ok) {
    return Response.json({ error: `the nta feed said ${response.status}` }, { status: 502 });
  }
  const feed = await response.json();

  // keep only what i need from each bus (some entries have no position, so they're skipped)
  const vehicles: Bus[] = [];
  for (const entity of feed.entity ?? []) {
    const v = entity.vehicle;
    if (!v || !v.position) continue;
    const routeId = v.trip?.route_id ?? "";
    vehicles.push({
      id: v.vehicle?.id ?? entity.id,
      route: routeId.split(" ")[1] ?? "", // "1 7A c a" -> "7A"
      routeId: routeId,
      tripId: v.trip?.trip_id ?? "",
      direction: v.trip?.direction_id ?? null,
      lat: v.position.latitude,
      lon: v.position.longitude,
      sentAt: Number(v.timestamp),
    });
  }

  // save this whole minute of the feed in the cloud: one document per fetch, in the "nta_feed" collection
  await db.collection("nta_feed").add({
    fetchedAt: FieldValue.serverTimestamp(),
    feedTime: Number(feed.header?.timestamp), // when the nta made this version of the feed
    count: vehicles.length,
    vehicles: vehicles,
  });

  return Response.json(answer(route, vehicles, Date.now()));
}

// what goes back to the phone: only the buses of its route
function answer(route: string, vehicles: Bus[], fetchedAt: number) {
  return { route: route, fetchedAt: fetchedAt, buses: vehicles.filter((bus) => bus.route === route) };
}
