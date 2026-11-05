"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "./firebase";
import { saveFix, startRide } from "./cloud";
import { Fix, HEADER, toFix, toRow } from "./toRow";

// the map needs the real browser to draw, so it never runs on the server
const RideMap = dynamic(() => import("./RideMap"), { ssr: false });

// for every fix: still waiting, already in the cloud, or it failed
type CloudState = "waiting" | "saved" | "failed";

// the two middle columns of the table, you can switch them by tapping their header
type Column = "accuracy" | "speed" | "heading" | "altitude" | "upload";
const COLUMNS: Column[] = ["accuracy", "speed", "heading", "altitude", "upload"];
const COLUMN_NAMES: Record<Column, string> = {
  accuracy: "±m",
  speed: "km/h",
  heading: "Heading",
  altitude: "Alt m",
  upload: "Upload",
};
const COLUMNS_KEY = "ghost-bus-columns"; // so the phone remembers which columns i picked

// one live bus from the nta feed, the way my server sends it (see app/api/nta/route.ts)
type NtaBus = { id: string; route: string; lat: number; lon: number; sentAt: number; direction: number | null };

// everything is also kept in the phone's browser storage, so a reload in the middle of a ride loses nothing
const KEY = "ghost-bus-ride";

export default function Recorder() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [cloud, setCloud] = useState<Record<string, CloudState>>({}); // fix time -> its cloud state
  const [uploadTime, setUploadTime] = useState<Record<string, number>>({}); // fix time -> seconds it took to reach the cloud
  const [columns, setColumns] = useState<Column[]>(["accuracy", "speed"]);
  const [route, setRoute] = useState("7A");
  const [rideId, setRideId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now()); // for the elapsed clock
  const [recording, setRecording] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [ntaBuses, setNtaBuses] = useState<NtaBus[] | null>(null); // null = not asked yet
  const [ntaError, setNtaError] = useState(false);
  const watchId = useRef<number | null>(null);
  const ridePromise = useRef<Promise<string> | null>(null); // the ride id, once the ride exists

  // once, after the page opens: bring back the ride from before a reload
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved) {
      // browser storage doesn't exist during the server render, so it can only be read here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFixes(saved.fixes);
      setCloud(saved.cloud);
      setUploadTime(saved.uploadTime ?? {});
      setRoute(saved.route);
      setRideId(saved.rideId);
      setStartedAt(saved.startedAt);
      // fixes that were still waiting when the page closed stay in firestore's cache and go up by themselves,
      // so once they're through, mark them saved
      const waiting = Object.keys(saved.cloud).filter((time) => saved.cloud[time] === "waiting");
      if (waiting.length > 0) {
        waitForPendingWrites(db).then(() => waiting.forEach((time) => setCloudState(time, "saved")));
      }
      if (saved.recording) {
        start(saved.rideId); // it was recording when the page closed, so it carries on with the same ride
      }
    }
    const savedColumns = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "null");
    if (savedColumns) setColumns(savedColumns);
    setLoaded(true);

    // the "no signal" message
    function checkSignal() {
      setOnline(navigator.onLine);
    }
    checkSignal();
    window.addEventListener("online", checkSignal);
    window.addEventListener("offline", checkSignal);

    return () => {
      window.removeEventListener("online", checkSignal);
      window.removeEventListener("offline", checkSignal);
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // every time something changes, save it in the browser storage too (not before the old ride is loaded)
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify({ fixes, cloud, uploadTime, route, rideId, startedAt, recording }));
  }, [loaded, fixes, cloud, uploadTime, route, rideId, startedAt, recording]);

  // while recording, ask my server for the live nta buses of my route, straight away and then every 15 s.
  // my server still only goes to the nta once a minute, it gives back its saved copy until that copy is 60 s old.
  // on my first real ride i asked every 60 s, but the saved copy was always just under 60 s old when i asked,
  // so i got the old copy every second time and the buses only moved every 2 minutes
  useEffect(() => {
    if (!recording) return;
    async function askNta() {
      try {
        const response = await fetch(`/api/nta?route=${encodeURIComponent(route)}`);
        if (!response.ok) throw new Error(`server said ${response.status}`);
        const data = await response.json();
        setNtaBuses(data.buses);
        setNtaError(false);
      } catch {
        setNtaError(true);
      }
    }
    askNta();
    const timer = setInterval(askNta, 15_000);
    return () => clearInterval(timer);
  }, [recording, route]);

  // the elapsed clock only ticks while recording
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  function setCloudState(time: string, state: CloudState) {
    // if the row was cleared in the meantime, leave it out
    setCloud((old) => (time in old ? { ...old, [time]: state } : old));
  }

  function onPosition(p: GeolocationPosition) {
    setGpsError("");
    const fix = toFix(p);
    setFixes((old) => [...old, fix]);
    setCloud((old) => ({ ...old, [fix.time]: "waiting" }));
    upload(fix);
  }

  // sends one fix to the cloud and marks it saved or failed once google answers
  async function upload(fix: Fix) {
    try {
      const id = await ridePromise.current!;
      await saveFix(id, fix);
      setCloudState(fix.time, "saved");
      // how long it took from my page getting the fix to google having it, this is the real-time part
      const seconds = (Date.now() - Date.parse(fix.time)) / 1000;
      setUploadTime((old) => ({ ...old, [fix.time]: seconds }));
      setCloudError("");
    } catch (e) {
      setCloudState(fix.time, "failed");
      setCloudError(`Fixes aren't reaching the cloud (${(e as { code?: string }).code ?? e}). They're still saved on this phone.`);
    }
  }

  // oldRideId is only there when it carries on after a reload, otherwise it's a new ride
  function start(oldRideId?: string | null) {
    setGpsError("");
    setCloudError("");
    if (oldRideId) {
      ridePromise.current = Promise.resolve(oldRideId);
    } else {
      ridePromise.current = startRide(route);
      setStartedAt(new Date().toISOString());
    }
    ridePromise.current.then(
      (id) => setRideId(id),
      (e) => setCloudError(`Can't reach the cloud (${e.code ?? e}). Fixes are still saved on this phone.`),
    );

    stopWatching(); // never two watches at once, or every fix would come twice
    watchId.current = navigator.geolocation.watchPosition(
      onPosition,
      (e) => setGpsError(e.message),
      // timeout: say so after 15 s without a position, instead of waiting silently forever
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    setRecording(true);
  }

  function stopWatching() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }

  function stop() {
    stopWatching();
    setRecording(false);
    setNtaBuses(null); // the board only shows live buses while recording
  }

  function download() {
    const csv = [HEADER, ...fixes.map(toRow)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ride-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clear() {
    if (!confirm(`Delete all ${fixes.length} rows on this phone? Download them first. The ones in the cloud stay there.`)) return;
    setFixes([]);
    setCloud({});
    setUploadTime({});
    setRideId(null);
    setStartedAt(null);
  }

  // tapping a column header moves it on to the next value (skipping the one the other column already shows)
  function nextColumn(slot: number) {
    const other = columns[slot === 0 ? 1 : 0];
    let next = COLUMNS.indexOf(columns[slot]);
    do {
      next = (next + 1) % COLUMNS.length;
    } while (COLUMNS[next] === other);
    const updated = [...columns];
    updated[slot] = COLUMNS[next];
    setColumns(updated);
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(updated));
  }

  // counting the cloud states for the counts strip
  const states = Object.values(cloud);
  const saved = states.filter((s) => s === "saved").length;
  const waiting = states.filter((s) => s === "waiting").length;
  const failed = states.filter((s) => s === "failed").length;
  const last = fixes.at(-1);

  // how long the ride has been going: till now while recording, till the last fix after stopping
  let elapsed = "0:00";
  if (startedAt && recording) elapsed = clock(now - Date.parse(startedAt));
  if (startedAt && !recording && last) elapsed = clock(Date.parse(last.time) - Date.parse(startedAt));

  // the map wants [lon, lat] for every fix
  const path = fixes.map((f) => [f.lon, f.lat] as [number, number]);

  // what the stop board says: how far the nearest live nta bus of my route is, and how old its position is
  let board = { text: "NTA FEED STARTS WITH YOUR RIDE", bright: false, count: "" };
  if (recording && ntaBuses === null) board = { text: "ASKING THE NTA...", bright: false, count: "" };
  if (ntaError) board = { text: "NTA FEED NOT REACHABLE", bright: false, count: "" };
  if (!ntaError && ntaBuses !== null && ntaBuses.length === 0) board = { text: "NO LIVE BUSES RIGHT NOW", bright: false, count: "" };
  if (!ntaError && ntaBuses !== null && ntaBuses.length > 0) {
    const count = `${ntaBuses.length} LIVE`;
    if (last) {
      // find the bus closest to me
      let nearest = ntaBuses[0];
      for (const bus of ntaBuses) {
        if (metres(last.lat, last.lon, bus.lat, bus.lon) < metres(last.lat, last.lon, nearest.lat, nearest.lon)) nearest = bus;
      }
      const away = metres(last.lat, last.lon, nearest.lat, nearest.lon);
      const age = Math.max(0, now / 1000 - nearest.sentAt); // seconds since that bus sent its position
      board = { text: `${shortDistance(away)} AWAY · ${shortAge(age)} OLD`, bright: true, count: count };
    } else {
      board = { text: "LIVE ON THE NTA FEED", bright: true, count: count };
    }
  }

  // the "in cloud" count turns amber when fixes are waiting, and red when some failed
  let cloudLabel = "in cloud";
  let cloudColour = "text-saved";
  if (waiting > 2) {
    cloudLabel = `${waiting} waiting`;
    cloudColour = "text-waiting";
  }
  if (failed > 0) {
    cloudLabel = `${failed} failed`;
    cloudColour = "text-signal";
  }

  let status = "Ready to record";
  let underStatus = "Set your route, then start";
  if (fixes.length > 0) {
    status = "Stopped";
    // when the ride was, since the counts under the board already say how many fixes there are
    if (startedAt && last) {
      underStatus = `Ride from ${clockTime(Date.parse(startedAt))} to ${clockTime(Date.parse(last.time))}`;
    } else {
      underStatus = "Download the CSV or start a new ride";
    }
  }
  if (recording) {
    status = "Recording";
    underStatus = startedAt ? `since ${clockTime(Date.parse(startedAt))}` : "";
  }

  return (
    // on a phone it's one column. on a wide screen the map goes on the left and the rest on the right
    <div className="flex min-h-dvh flex-col bg-paper pb-28 text-ink lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_480px] lg:grid-rows-[auto_auto_auto_auto_minmax(0,1fr)_auto] lg:pb-0">
      {/* the route band at the top, like on a timetable */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-route px-4 py-3 text-white lg:col-start-2">
        <input
          value={route}
          onChange={(e) => setRoute(e.target.value.toUpperCase())}
          disabled={recording}
          maxLength={5} // my firestore rules allow route names up to 5 characters
          aria-label="Bus route"
          // the box grows with the route name (7A, 46A, 79/X...), so nothing gets cut off
          style={{ width: `${Math.max(route.length, 2) + 1.5}ch` }}
          className="bg-white px-2 pb-0.5 pt-1 text-center font-condensed text-[44px] font-extrabold leading-none tracking-tight text-route"
        />
        <div className="min-w-0 leading-tight">
          <p className="text-[17px] font-semibold">{status}</p>
          <p className="truncate text-[13px] font-medium text-white/85">{underStatus}</p>
        </div>
        <p className="text-right font-condensed text-[28px] font-bold leading-none">
          {elapsed}
          <span className="block font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85">elapsed</span>
        </p>
      </header>

      {/* the stop board: what the NTA says about this bus (the live feed comes in the next step) */}
      <div className="flex items-baseline gap-3 bg-board px-4 py-2 font-dot text-[18px] leading-tight text-amber lg:col-start-2" aria-label="NTA live feed" aria-live="polite">
        <span>{route || "--"}</span>
        <span className={`flex-1 truncate ${board.bright ? "" : "text-amber-dim"}`}>{board.text}</span>
        {board.count && <span className="text-amber-dim">{board.count}</span>}
      </div>

      {/* the three counts */}
      <dl className="grid grid-cols-3 border-b-2 border-ink lg:col-start-2">
        <Count label="fixes" value={fixes.length.toLocaleString("en-IE")} colour="text-figure" />
        <Count label={cloudLabel} value={saved.toLocaleString("en-IE")} colour={cloudColour} />
        <Count label="accuracy" value={last ? `±${last.accuracy_m.toFixed(1)} m` : "–"} colour="text-figure" last />
      </dl>

      {/* messages when something is wrong */}
      <div className="lg:col-start-2">
        {!online && (
          <p className="bg-waiting px-4 py-2 text-[15px] font-semibold text-white" role="status">
            No signal. Fixes are kept on the phone and go up when it&apos;s back.
          </p>
        )}
        {gpsError && <p className="bg-signal px-4 py-2 text-[15px] font-semibold text-white" role="alert">{gpsError}</p>}
        {cloudError && <p className="bg-signal px-4 py-2 text-[15px] font-semibold text-white" role="alert">{cloudError}</p>}
      </div>

      {/* the map */}
      <div className="h-60 border-b-2 border-ink lg:col-start-1 lg:row-[1/-1] lg:h-auto lg:border-b-0 lg:border-r-2">
        <RideMap path={path} buses={ntaBuses ?? []} route={route} />
      </div>

      {/* the timetable: the last 8 fixes, newest on top. before the first ride it says what gets shared */}
      <div className="lg:col-start-2 lg:overflow-y-auto">
        {fixes.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
                <th className="px-4 pb-1.5 pt-2.5 text-left">Time</th>
                {columns.map((column, slot) => (
                  <th key={slot} className="px-1 text-right">
                    <button
                      onClick={() => nextColumn(slot)}
                      aria-label={`Showing ${COLUMN_NAMES[column]}, tap to switch`}
                      className="inline-flex min-h-9 items-center gap-1 px-2 uppercase tracking-[0.09em]"
                    >
                      {COLUMN_NAMES[column]}
                      <Chevron />
                    </button>
                  </th>
                ))}
                <th className="px-4 text-right">Cloud</th>
              </tr>
            </thead>
            <tbody className="border-t border-ink">
              {fixes.slice(-8).reverse().map((f, i) => (
                <tr key={f.time} className={`border-b border-rule text-[17px] ${i === 0 && recording ? "fresh font-semibold" : ""}`}>
                  <td className="px-4 py-2.5">{clockTime(Date.parse(f.time), true)}</td>
                  {columns.map((column, slot) => (
                    <td key={slot} className="px-3 text-right text-figure">{cellValue(f, column, uploadTime[f.time])}</td>
                  ))}
                  <td className="px-4 text-right">
                    <span className="mark" data-state={cloud[f.time] ?? "waiting"} aria-label={cloud[f.time] ?? "waiting"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <section className="max-w-prose px-4 py-5 text-[16px] leading-relaxed">
            <h2 className="mb-2 font-condensed text-[22px] font-bold uppercase tracking-[0.02em]">What gets shared</h2>
            <p>
              While you record, this page saves your position about once a second, with its accuracy, speed, heading,
              altitude and the time. Each fix goes to this project&apos;s cloud database for the ghost-bus study, and you
              can download all of them as a CSV. Nothing else about you or your phone is collected.
            </p>
            <p className="mt-3 text-muted">Keep the screen on with this page in front while you ride.</p>
          </section>
        )}
      </div>

      {/* the buttons, at the bottom where the thumb is */}
      <div className="fixed inset-x-0 bottom-0 grid grid-cols-[1fr_auto_auto] gap-2 border-t-2 border-ink bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 lg:static lg:col-start-2">
        {recording ? (
          <button onClick={stop} className="min-h-14 bg-signal font-condensed text-[22px] font-extrabold uppercase tracking-[0.04em] text-white">
            Stop recording
          </button>
        ) : (
          <button onClick={() => start()} className="min-h-14 bg-route font-condensed text-[22px] font-extrabold uppercase tracking-[0.04em] text-white">
            {fixes.length > 0 ? "Start a new ride" : "Start recording"}
          </button>
        )}
        <button onClick={download} disabled={fixes.length === 0} className="min-h-14 border-2 border-ink px-4 text-[15px] font-bold disabled:opacity-40">
          CSV
        </button>
        <button onClick={clear} disabled={recording || fixes.length === 0} className="min-h-14 border-2 border-ink px-3 text-[15px] font-bold disabled:opacity-40">
          Clear
        </button>
      </div>
    </div>
  );
}

// one of the three counts under the stop board
function Count({ label, value, colour, last = false }: { label: string; value: string; colour: string; last?: boolean }) {
  return (
    <div className={last ? "px-4 py-2.5" : "border-r border-rule px-4 py-2.5"}>
      <dd className={`font-condensed text-[24px] font-bold leading-tight ${colour}`}>{value}</dd>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
    </div>
  );
}

// what one cell of the table shows for a fix, for the column that's picked
function cellValue(f: Fix, column: Column, uploadSeconds: number | undefined) {
  if (column === "accuracy") return f.accuracy_m.toFixed(1);
  if (column === "speed") return f.speed_mps === null ? "–" : (f.speed_mps * 3.6).toFixed(1);
  if (column === "heading") {
    if (f.heading_deg === null || Number.isNaN(f.heading_deg)) return "–"; // no heading when standing still
    return `${compass(f.heading_deg)} ${Math.round(f.heading_deg)}°`;
  }
  if (column === "altitude") return f.altitude_m === null ? "–" : Math.round(f.altitude_m).toString();
  return uploadSeconds === undefined ? "–" : `${uploadSeconds.toFixed(1)} s`; // upload
}

// the distance between two places in metres, along the earth's curve (the haversine formula)
function metres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000; // the earth's radius in metres
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

// 130 -> "130M", 1240 -> "1.2KM", for the stop board
function shortDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}M`;
  return `${(m / 1000).toFixed(1)}KM`;
}

// 40 -> "40S", 727 -> "12MIN", for the stop board
function shortAge(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}S`;
  return `${Math.round(seconds / 60)}MIN`;
}

// 42 degrees -> "NE"
function compass(degrees: number) {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(degrees / 45) % 8];
}

// the small arrow next to a column header, so you can tell it can be tapped
function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// milliseconds -> "12:48" (or "1:02:48" after an hour)
function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  return `${minutes}:${seconds}`;
}

// a time of day, like "15:22", or "15:22:58" with seconds
function clockTime(ms: number, withSeconds = false) {
  if (withSeconds) {
    return new Date(ms).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return new Date(ms).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}
