"use client";

import { useEffect, useState } from "react";
import "./stop.css";

type Row = { tripId: string; startDate: string; route: string; to: string; due: number; vehicle: string | null; age: number | null; metres: number | null; flag: string };
type Board = { stop: { id: string; name: string; lat: number; lon: number }; tripsAt: number; rows: Row[] };
type Verdict = { verdict: string; reason: string; witnesses: number };

// what the stamp says for each verdict from /api/report
const STAMPS: Record<string, string> = { ghost: "VERIFIED GHOST", came: "BUS CAME", late: "LATE, NOT A GHOST", unclear: "UNCLEAR" };
type Nearby = { id: string; name: string; metres: number };

// the phone at a bus stop: pick your stop, see what the board says, and what ghost bus found behind each line
export default function StopPage() {
  const [stopId, setStopId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [distance, setDistance] = useState<number | null>(null); // how far i am from the stop, if i know
  const [demo, setDemo] = useState(false); // demo stop (?demo=1): counted as at the stop, for the classroom
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({}); // trip id -> the verdict
  const [reporting, setReporting] = useState<string | null>(null);

  // a stop in the link (?stop=...) opens straight away, so a qr code can send people to one stop
  useEffect(() => {
    // the link only exists in the browser, so it can only be read here
    const link = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStopId(link.get("stop"));
    setDemo(link.get("demo") === "1");
  }, []);

  // once a minute: "a witness is at this stop", with the stop's position, never mine
  useEffect(() => {
    if (!board) return;
    const id = sessionId();
    const say = () =>
      fetch("/api/here", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, lat: board.stop.lat, lon: board.stop.lon, mode: "stop" }) }).catch(() => {});
    say();
    const timer = setInterval(say, 60_000);
    return () => clearInterval(timer);
  }, [board?.stop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // the board refreshes every 20 s, the minutes count down every second
  useEffect(() => {
    if (!stopId) return;
    async function ask() {
      const response = await fetch(`/api/board?stop=${encodeURIComponent(stopId!)}`);
      if (response.ok) setBoard(await response.json());
      else setProblem("That stop isn't a Dublin bus stop I know.");
    }
    ask();
    const timer = setInterval(ask, 20_000);
    return () => clearInterval(timer);
  }, [stopId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // finds the 4 closest stops. my location is only used here on the phone, it's never sent anywhere
  function findMyStop() {
    setFinding(true);
    setProblem("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const stops: Record<string, [string, number, number]> = await (await fetch("/gtfs/stops.json")).json();
        const busStops: Record<string, string[]> = await (await fetch("/gtfs/stop_routes.json")).json();
        const list: Nearby[] = [];
        for (const id in busStops) {
          if (!stops[id]) continue;
          list.push({ id, name: stops[id][0], metres: here(latitude, longitude, stops[id][1], stops[id][2]) });
        }
        list.sort((a, b) => a.metres - b.metres);
        setNearby(list.slice(0, 4));
        setFinding(false);
      },
      () => {
        setProblem("I couldn't get your location. Allow location for this site and try again.");
        setFinding(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function choose(id: string, metres: number | null) {
    setDistance(metres);
    setBoard(null);
    setNearby([]);
    setStopId(id);
    history.replaceState(null, "", `?stop=${id}`);
  }

  // "it didn't come": the server checks it against the nta's data and sends back a verdict.
  // only the distance to the stop is sent, never my location
  async function report(row: Row) {
    setReporting(row.tripId);
    let metresFromStop = distance;
    if (metresFromStop === null && !demo && board) {
      metresFromStop = await new Promise<number | null>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(Math.round(here(p.coords.latitude, p.coords.longitude, board.stop.lat, board.stop.lon))),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 15_000 },
        ),
      );
      setDistance(metresFromStop);
    }
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stop: stopId, tripId: row.tripId, startDate: row.startDate, route: row.route, due: row.due, metresFromStop, demo, cancelled: row.flag === "cancelled" }),
    });
    if (response.ok) {
      const answer = await response.json();
      setVerdicts((old) => ({ ...old, [row.tripId]: answer }));
    } else {
      setProblem("The report didn't go through. Try again.");
    }
    setReporting(null);
  }

  return (
    <main className="case-phone">
      <div className="phone-folder">
        <p className="phone-tab">CASE GB-26 · AT THE STOP</p>

        {!stopId && (
          <>
            <h1 className="stop-name">Which stop are you at?</h1>
            <p className="stop-meta">Ghost bus checks every line on your stop&apos;s board against the buses actually out there.</p>
            <button className="case-button" onClick={findMyStop} disabled={finding}>
              {finding ? "Finding your stop…" : "Find my stop"}
            </button>
            <p className="small-print">Your location stays on this phone. It&apos;s only used to find the nearest stop.</p>
            {nearby.map((stop) => (
              <button key={stop.id} className="stop-choice" onClick={() => choose(stop.id, stop.metres)}>
                <span>{stop.name}</span>
                <span>{Math.round(stop.metres)} m</span>
              </button>
            ))}
          </>
        )}

        {problem && <p className="small-print">{problem}</p>}

        {stopId && (
          <>
            <h1 className="stop-name">{board?.stop.name ?? "Opening the stop…"}</h1>
            <p className="stop-meta">
              Stop {stopId.slice(-4).replace(/^0+/, "")}
              {board && ` · checked at ${new Date(board.tripsAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}`}
            </p>

            {demo && <p className="small-print">Demo stop: everyone here counts as standing at this stop.</p>}
            <p className="exhibit-label">EXHIBIT B · WHAT THE BOARD SAYS, AND WHAT IS REALLY THERE</p>
            {board && board.rows.length === 0 && <p className="empty">Nothing due here in the next hour.</p>}
            {board?.rows.slice(0, 8).map((row, i) => (
              <div className="entry" key={i}>
                <p className="board board-line">
                  <span>{row.route}</span>
                  <span className="to">{row.to}</span>
                  <span>{minutes(row.due, now)}</span>
                </p>
                {verdicts[row.tripId] ? (
                  <div className="check verdict">
                    <p className={`verdict-stamp ${verdicts[row.tripId].verdict}`}>{STAMPS[verdicts[row.tripId].verdict]}</p>
                    <p>{verdicts[row.tripId].reason}</p>
                    {verdicts[row.tripId].witnesses > 1 && <p className="small-print">{verdicts[row.tripId].witnesses} people reported this trip here.</p>}
                  </div>
                ) : (
                  <div className={`check ${row.flag ? "bad" : row.vehicle ? "ok" : ""}`}>
                    <p>{check(row)}</p>
                    {row.due < now && (
                      <button className="didnt-come" onClick={() => report(row)} disabled={reporting === row.tripId}>
                        {reporting === row.tripId ? "Checking…" : "It didn't come"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button className="change-stop" onClick={() => { setStopId(null); setBoard(null); setDistance(null); setVerdicts({}); history.replaceState(null, "", "?"); }}>
              Change stop
            </button>
          </>
        )}
      </div>
    </main>
  );
}

// a random id for this tab, so the projector can count phones without knowing who they are
function sessionId() {
  let id = sessionStorage.getItem("ghost-bus-id");
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem("ghost-bus-id", id);
  }
  return id;
}

// what ghost bus types under a board line
function check(row: Row) {
  if (row.flag === "cancelled") return "The NTA has cancelled this trip, but it's still listed.";
  if (row.flag === "no bus") return "No bus is running this trip right now.";
  if (row.flag === "frozen") return `Bus ${row.vehicle}'s position is ${Math.round(row.age! / 60)} min old. It could be anywhere.`;
  if (row.vehicle) return `Bus ${row.vehicle} is ${away(row.metres!)} away, seen ${row.age} s ago.`;
  return "Hasn't started its trip yet.";
}

// like the real boards: "Due" under a minute, otherwise whole minutes
function minutes(due: number, now: number) {
  const left = Math.floor((due - now) / 60_000);
  return left < 1 ? "Due" : `${left} min`;
}

function away(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

// distance in metres (haversine, same as the rest of the app)
function here(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
