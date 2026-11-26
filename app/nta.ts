import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";

// everything that talks to the nta lives here, and only runs on vercel's server (it needs the keys).
// /api/nta uses it for the phones, and /api/collect uses it for the city-wide audit at rush hour.

const VEHICLES = "https://api.nationaltransport.ie/gtfsr/v2/Vehicles?format=json";
const TRIPS = "https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json";

// one bus from the vehicles feed, the way i save it
export type Bus = {
  id: string; // the bus's own number
  route: string; // "7A"
  routeId: string; // how the feed names the route, like "1_7A_c_a"
  tripId: string;
  direction: number | null;
  lat: number;
  lon: number;
  sentAt: number; // when the bus sent this position (unix seconds), so i can see how old it is
};

// firebase admin is the server version of firebase. it can write to the database without the phone rules
export function database(): Firestore {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

// the public route number is the second word of the nta's route id.
// the nta changed its ids on 23 nov 2026 from "1 7A c a" to "1_7A_c_a", so i split on a space or an underscore
export function routeName(routeId: string) {
  return routeId.split(/[ _]/)[1] ?? "";
}

// the latest bus positions. the nta only allows one call a minute per key, so if the feed was
// fetched less than 60 s ago i reuse that copy, otherwise i fetch a new one and save it in "nta_feed".
// shortcut: two callers at the exact same moment could both fetch, fine for a few riders
export async function latestVehicles(db: Firestore) {
  const latest = await db.collection("nta_feed").orderBy("fetchedAt", "desc").limit(1).get();
  if (!latest.empty) {
    const saved = latest.docs[0].data();
    const age = Date.now() - saved.fetchedAt.toMillis();
    if (age < 60_000) {
      return { vehicles: saved.vehicles as Bus[], fetchedAt: saved.fetchedAt.toMillis(), fresh: false };
    }
  }

  // ask the nta for every bus in ireland right now
  const response = await fetch(VEHICLES, { headers: { "x-api-key": process.env.NTA_KEY! }, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`the nta vehicles feed said ${response.status}`);
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
      route: routeName(routeId),
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
  return { vehicles, fetchedAt: Date.now(), fresh: true };
}

// the order of the values for one trip in a "trip_feed" document (saved as a list, not as names, to keep it small)
export const TRIP_COLUMNS = [
  "tripId", "routeId", "route", "direction", "startTime", "startDate",
  "status", // SCHEDULED, ADDED or CANCELED
  "vehicleId", // "" when no bus is linked to the trip yet
  "stops", "skipped", // how many stops have a prediction, and how many of them are skipped
  "firstStop", "firstDelay", "lastDelay", // the next stop it predicts, and its delay in seconds there and at the last stop
  "updates", // every stop prediction, like "54:4437;56:4510" (stop sequence:delay)
];

// the predictions the boards show (TripUpdates). a ghost bus lives here: a trip that is still predicted
// but never gets a bus, or is cancelled but still shown. one compact document per fetch in "trip_feed".
// the trips go in as one json text, because firestore would otherwise index every value and run out of space
export async function saveTrips(db: Firestore) {
  const key = process.env.NTA_KEY_TRIPS ?? process.env.NTA_KEY!; // a second key if i have one, so both feeds get their own minute
  const response = await fetch(TRIPS, { headers: { "x-api-key": key }, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`the nta trip updates feed said ${response.status}`);
  }
  const feed = await response.json();

  const trips: (string | number | null)[][] = [];
  for (const entity of feed.entity ?? []) {
    const t = entity.trip_update;
    if (!t) continue;
    const stops = t.stop_time_update ?? [];
    type StopUpdate = { stop_sequence?: number; arrival?: { delay?: number }; departure?: { delay?: number } };
    const delay = (u: StopUpdate | undefined) => u?.arrival?.delay ?? u?.departure?.delay ?? null;
    trips.push([
      t.trip?.trip_id ?? "",
      t.trip?.route_id ?? "",
      routeName(t.trip?.route_id ?? ""),
      t.trip?.direction_id ?? null,
      t.trip?.start_time ?? "",
      t.trip?.start_date ?? "",
      t.trip?.schedule_relationship ?? "SCHEDULED",
      t.vehicle?.id ?? "",
      stops.length,
      stops.filter((u: { schedule_relationship?: string }) => u.schedule_relationship === "SKIPPED").length,
      stops[0]?.stop_id ?? "",
      delay(stops[0]),
      delay(stops.at(-1)),
      // board time at a stop = timetable time + the delay of the last update before it
      stops.map((u: StopUpdate) => `${u.stop_sequence ?? ""}:${delay(u) ?? ""}`).join(";"),
    ]);
  }

  await db.collection("trip_feed").add({
    fetchedAt: FieldValue.serverTimestamp(),
    feedTime: Number(feed.header?.timestamp),
    count: trips.length,
    columns: TRIP_COLUMNS,
    trips: JSON.stringify(trips),
  });
  return trips.length;
}

// like latestVehicles: one call a minute per key, so skip if saved under 60 s ago.
// select() only reads the time, not the whole 300 KB document
export async function latestTrips(db: Firestore) {
  const latest = await db.collection("trip_feed").orderBy("fetchedAt", "desc").limit(1).select("fetchedAt").get();
  if (!latest.empty && Date.now() - latest.docs[0].data().fetchedAt.toMillis() < 60_000) {
    return { fresh: false, count: null };
  }
  return { fresh: true, count: await saveTrips(db) };
}
