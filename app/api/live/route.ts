import { checkCity } from "../../analysis";
import { database, latestTrips, latestVehicles, newestTrips } from "../../nta";

// /api/live: the whole of dublin right now, for the projector screen (/live).
// the screen asks every 20 s, but the nta still only gets called once a minute per key (same reuse rule)

export async function GET() {
  const db = database();
  try {
    const { vehicles, fetchedAt } = await latestVehicles(db);
    if (process.env.NTA_KEY_TRIPS) {
      await latestTrips(db).catch((error) => console.error("trip updates not saved", error));
    }
    const { fetchedAt: tripsAt, trips } = await newestTrips(db);
    const city = checkCity(vehicles, fetchedAt, trips, tripsAt);

    // people using the app in the last 3 minutes (they say "i'm here" through /api/here)
    const recent = await db.collection("live_riders").where("at", ">", Date.now() - 3 * 60_000).get();
    const riders = recent.docs.map((d) => ({ lat: d.data().lat, lon: d.data().lon, mode: d.data().mode }));

    // the latest verdicts from "it didn't come" (the extra task), newest first
    const latestReports = await db.collection("reports").orderBy("at", "desc").limit(5).get();
    const reports = latestReports.docs.map((d) => {
      const r = d.data();
      return { route: r.route, stopName: r.stopName, verdict: r.verdict, reason: r.reason, witnesses: r.witnesses, at: r.at, demo: r.demo };
    });

    return Response.json({
      reports: reports,
      vehiclesAt: fetchedAt,
      tripsAt: tripsAt,
      buses: city.dublinBuses.map((v) => [v.lon, v.lat]), // just the dots
      frozen: city.frozen.map((v) => ({ id: v.id, route: v.route, lat: v.lat, lon: v.lon, age: Math.round(fetchedAt / 1000 - v.sentAt) })),
      shouldBeRunning: city.shouldBeRunning,
      noBus: city.noBus.length,
      // a few examples for the screen, the latest ones first
      noBusExamples: city.noBus
        .sort((a, b) => b.startTime.localeCompare(a.startTime))
        .slice(0, 6)
        .map((t) => ({ route: t.route, start: t.startTime.slice(0, 5), delay: t.firstDelay })),
      riders: riders,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
