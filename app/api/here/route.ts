import { NextRequest } from "next/server";
import { database } from "../../nta";

// phones using the app say "i'm here" once a minute, so the projector can show the witnesses.
// a phone at a stop sends the stop's position (not its own), a phone on a bus sends its last fix
// (which it's already uploading for the ride). each phone has a random id that's forgotten when the tab closes

export async function POST(request: NextRequest) {
  const { id, lat, lon, mode, busId, rideId } = await request.json();
  if (typeof id !== "string" || id.length > 40 || typeof lat !== "number" || typeof lon !== "number") {
    return Response.json({ error: "send id, lat and lon" }, { status: 400 });
  }
  await database()
    .collection("live_riders")
    .doc(id)
    .set({
      lat,
      lon,
      mode: mode === "bus" ? "bus" : "stop",
      busId: typeof busId === "string" ? busId : null, // the nta bus the rider's phone matched, if it has
      rideId: typeof rideId === "string" ? rideId : null,
      at: Date.now(),
    });
  return Response.json({ ok: true });
}
