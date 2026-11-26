"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Frozen, Rider } from "./CityMap";

// the map only works in the browser, so it's loaded there
const CityMap = dynamic(() => import("./CityMap"), { ssr: false });

type Live = {
  vehiclesAt: number;
  tripsAt: number;
  buses: [number, number][];
  frozen: Frozen[];
  shouldBeRunning: number;
  noBus: number;
  noBusExamples: { route: string; start: string; delay: number | null }[];
  riders: Rider[];
};

// the projector screen for the demo: the whole of dublin, live, checked every minute
export default function LivePage() {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(Date.now());

  // always the night board on the projector
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // ask my server every 20 s (it only calls the nta once a minute)
  useEffect(() => {
    async function ask() {
      const response = await fetch("/api/live");
      if (response.ok) setLive(await response.json());
    }
    ask();
    const timer = setInterval(ask, 20_000);
    return () => clearInterval(timer);
  }, []);

  // the clock and the "feed is x s old" tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const feedAge = live ? Math.max(0, Math.round((now - live.vehiclesAt) / 1000)) : null;
  const clock = new Date(now).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <main className="grid h-screen grid-cols-[3fr_2fr] grid-rows-[auto_1fr_auto] bg-board text-ink">
      <header className="col-span-2 flex items-baseline justify-between border-b border-rule px-8 py-4">
        <h1 className="font-condensed text-4xl font-bold tracking-wide">
          GHOST BUS <span className="text-signal">● LIVE</span> <span className="text-muted">DUBLIN</span>
        </h1>
        <p className="font-dot text-3xl text-amber">
          {clock} · NTA FEED {feedAge === null ? "…" : `${feedAge}S`} OLD
        </p>
      </header>

      <section className="relative border-r border-rule">
        {live && <CityMap buses={live.buses} frozen={live.frozen} riders={live.riders} />}
        <p className="absolute bottom-4 left-4 bg-board/80 px-3 py-2 text-lg text-muted">
          <span className="text-amber">●</span> bus on the NTA feed &nbsp; <span className="text-ink">◯</span> position over 3 min old &nbsp;{" "}
          <span className="text-signal">●</span> ghost bus rider
        </p>
      </section>

      <section className="flex flex-col gap-8 overflow-hidden px-8 py-6">
        {/* the stop board telling on itself: each line is a number from the nta's own data */}
        <div className="font-dot text-amber">
          <BoardLine label="BUSES ON THE FEED NOW" value={live?.buses.length} />
          <BoardLine label="POSITION OVER 3 MIN OLD" value={live?.frozen.length} />
          <BoardLine label="TRIPS DUE WITH NO BUS" value={live?.noBus} after={live ? ` / ${live.shouldBeRunning}` : ""} />
          <BoardLine label="RIDERS CONNECTED" value={live?.riders.length} />
        </div>

        <div>
          <h2 className="mb-2 font-condensed text-2xl font-bold text-muted">ON THE BOARDS, BUT NO BUS IS RUNNING THEM</h2>
          <ul className="font-dot text-2xl text-amber">
            {live?.noBusExamples.map((trip, i) => (
              <li key={i} className="flex justify-between border-b border-rule/60 py-1">
                <span className="w-24">{trip.route}</span>
                <span className="flex-1">{trip.start}</span>
                <span className="text-signal">NO BUS</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="col-span-2 border-t border-rule px-8 py-2 text-base text-muted">
        Live data: NTA GTFS-Realtime (vehicle positions and trip updates), CC BY 4.0, provided as is. Saved and checked every minute by ghost bus.
      </footer>
    </main>
  );
}

// one line of the board, with the number counting up to its new value
function BoardLine({ label, value, after = "" }: { label: string; value: number | undefined; after?: string }) {
  const shown = useCountUp(value ?? 0);
  return (
    <p className="flex justify-between border-b border-rule/60 py-2 text-3xl">
      <span>{label}</span>
      <span className="text-5xl">
        {value === undefined ? "…" : shown}
        <span className="text-2xl text-amber-dim">{after}</span>
      </span>
    </p>
  );
}

// counts from the old number to the new one in about half a second (no animation if the laptop asks for less motion)
function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const share = Math.min(1, (t - began) / 600);
      setShown(Math.round(start + (target - start) * (1 - (1 - share) ** 3))); // slows down at the end
      if (share < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}
