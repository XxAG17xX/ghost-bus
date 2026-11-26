"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import "../live/case.css";

const ReplayMap = dynamic(() => import("./ReplayMap"), { ssr: false });

// my real 13 ride on 26 nov, out towards takeda (the one in the demo script). ?ride=... plays another one
const DEMO_RIDE = "RPuhqO2U28AEN3sFuDAa";

type Replay = { route: string; myBus: string | null; start: number; end: number; fixes: [number, number, number][]; nta: [number, number, number, number][] };

// exhibit c: one real ride played back on the projector, my phone against what the nta said about my bus
export default function ReplayPage() {
  const [data, setData] = useState<Replay | null>(null);
  const [t, setT] = useState(0); // the replay clock, in real milliseconds of the ride
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20);

  useEffect(() => {
    const ride = new URLSearchParams(window.location.search).get("ride") ?? DEMO_RIDE;
    fetch(`/api/replay?ride=${ride}`)
      .then((r) => r.json())
      .then((d: Replay) => {
        setData(d);
        setT(d.start);
      });
  }, []);

  // every 100 ms the clock moves on by 100 ms times the speed
  useEffect(() => {
    if (!playing || !data) return;
    const timer = setInterval(() => {
      setT((old) => {
        const next = old + 100 * speed;
        if (next >= data.end) {
          setPlaying(false);
          return data.end;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [playing, speed, data]);

  // space plays and pauses during the demo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // where i was at time t, and the newest nta position my app had at time t
  const done = data ? data.fixes.filter((f) => f[0] <= t) : [];
  const me = done.length > 0 ? done[done.length - 1] : null;
  const seen = data ? data.nta.filter((n) => n[0] <= t) : [];
  const claim = seen.length > 0 ? seen[seen.length - 1] : null;
  const age = claim ? Math.round(t / 1000 - claim[3]) : null;
  const gap = me && claim ? Math.round(metres(me[2], me[1], claim[2], claim[1])) : null;
  const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Dublin" });

  return (
    <main className="desk">
      <div className="folder">
        <p className="tab tab-left">CASE GB-26 · EXHIBIT C · REPLAY OF A REAL RIDE</p>
        <p className="tab tab-right">{data ? `${new Date(data.start).toLocaleDateString("en-IE", { day: "numeric", month: "short" })} · ${clock(t)}` : "…"}</p>
        <h1 className="case-title">Route {data?.route ?? "…"}, on board</h1>

        <section className="exhibit">
          <div className="exhibit-map">
            <ReplayMap trace={done.map((f) => [f[1], f[2]])} me={me ? [me[1], me[2]] : null} nta={seen.map((n) => [n[1], n[2]])} />
          </div>
          <p className="exhibit-caption">
            <b>Exhibit C.</b> Red: my phone, on the bus. Empty ring: where the NTA said my bus was at that moment.
          </p>
        </section>

        <section className="sheet">
          <p className="sheet-head">Replay at {speed}× speed</p>
          {!data && <p className="finding-main">Opening the ride…</p>}
          {data && (
            <>
              <p className="finding-main">
                My bus was <span className="marked">{data.myBus ?? "?"}</span>
              </p>
              <p className="join-what">Found by itself: the one bus that stayed within 60 m of my phone, copy after copy.</p>
              <ol className="findings">
                <li>
                  <span>1.</span>
                  <span>
                    The NTA&apos;s position was <b>{age ?? "…"} s</b> old.
                  </span>
                </li>
                <li>
                  <span>2.</span>
                  <span>
                    It put my bus <b>{gap ?? "…"} m</b> from where I really was.
                  </span>
                </li>
              </ol>
              <div className="log replay-controls">
                <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : t > data.start ? "Play on" : "Play"}</button>
                <button onClick={() => setSpeed(speed === 20 ? 60 : 20)}>{speed === 20 ? "Faster" : "Slower"}</button>
                <button onClick={() => { setT(data.start); setPlaying(false); }}>Restart</button>
              </div>
            </>
          )}
        </section>

        <div className="source">
          <p>My own GPS (first and last minute cut) and the NTA GTFS-Realtime positions saved during the ride.</p>
          <p className="scene-tabs">
            <Link href="/live">Back to the city</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// distance in metres (haversine)
function metres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
