import { NextRequest } from "next/server";
import { database, latestTrips, latestVehicles } from "../../nta";

// the city-wide ghost audit. a github action calls this once a minute during the morning and evening
// rush hour, so both nta feeds get saved even when nobody is riding with my app.
// it needs a secret token, so random people can't make my server call the nta.

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
      result.tripsFresh = fresh; // false when a phone had already saved them less than a minute ago
    } catch (error) {
      result.tripsError = String(error); // a 429 here just means a phone used the key this minute, the next run catches up
    }
  }
  return Response.json(result);
}
