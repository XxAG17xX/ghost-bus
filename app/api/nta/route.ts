import { NextRequest } from "next/server";
import { Bus, database, latestTrips, latestVehicles } from "../../nta";

// this file runs on vercel's server, not on the phone, so the nta key and the firebase server key stay secret.
// the phone calls /api/nta?route=7A every 15 s while it's recording, but this only goes to the nta once a minute
// (the fetching and saving is in app/nta.ts, shared with /api/collect).

// my live site, which has both keys
const LIVE = "https://ghost-bus-a3.vercel.app/api/nta";

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

  try {
    const db = database();
    const { vehicles, fetchedAt } = await latestVehicles(db);
    // while someone rides, the board predictions get saved every minute too (with my second key), not only at
    // rush hour, so every ride can be checked against what the boards said. if this fails the ride still goes on
    if (process.env.NTA_KEY_TRIPS) {
      await latestTrips(db).catch((error) => console.error("trip updates not saved", error));
    }
    return Response.json(answer(route, vehicles, fetchedAt));
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}

// what goes back to the phone: only the buses of its route
function answer(route: string, vehicles: Bus[], fetchedAt: number) {
  return { route: route, fetchedAt: fetchedAt, buses: vehicles.filter((bus) => bus.route === route) };
}
