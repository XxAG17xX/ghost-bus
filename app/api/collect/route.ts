import { NextRequest } from "next/server";
import { database, latestTrips, latestVehicles } from "../../nta";

// the city-wide ghost audit: cron-job.org calls this once a minute at rush hour,
// so both feeds get saved even when nobody rides. needs my secret token

export async function GET(request: NextRequest) {
  if (!process.env.COLLECT_TOKEN || request.headers.get("authorization") !== `Bearer ${process.env.COLLECT_TOKEN}`) {
    return Response.json({ error: "not allowed" }, { status: 401 });
  }
  const db = database();
  const result: Record<string, unknown> = { at: new Date().toISOString() };

  // with one key the two feeds take turns (vehicles on even minutes, trip updates on odd ones),
  // because the nta allows one call a minute per key. with a second key both run every minute
  const twoKeys = Boolean(process.env.NTA_KEY_TRIPS);
  const even = new Date().getUTCMinutes() % 2 === 0;

  if (twoKeys || even) {
    try {
      const { vehicles, fresh } = await latestVehicles(db);
      result.vehicles = vehicles.length;
      result.vehiclesFresh = fresh; // false when a phone had already fetched it less than a minute ago
    } catch (error) {
      result.vehiclesError = String(error);
    }
  }
  if (twoKeys || !even) {
    try {
      const { fresh, count } = await latestTrips(db);
      result.trips = count;
      result.tripsFresh = fresh; // false if a phone saved them this minute
    } catch (error) {
      result.tripsError = String(error); // a 429 here just means a phone used the key this minute, the next run catches up
    }
  }
  return Response.json(result);
}
