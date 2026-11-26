"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Frozen, Rider } from "./CityMap";
import "./case.css";

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

// the projector screen for the demo: dublin's buses as an open case file, live from the nta
export default function LivePage() {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(Date.now());

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

  // the clock and the feed age tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = (ms: number, seconds = false) =>
    new Date(ms).toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
      second: seconds ? "2-digit" : undefined,
    });
  const feedAge = live
    ? Math.max(0, Math.round((now - live.vehiclesAt) / 1000))
    : null;

  const noBus = useTyped(live ? String(live.noBus) : "…");
  const frozen = useTyped(live ? String(live.frozen.length) : "…");
  const buses = useTyped(live ? String(live.buses.length) : "…");
  const riders = useTyped(live ? String(live.riders.length) : "…");

  return (
    <main className="desk">
      <div className="folder">
        <p className="tab tab-left">CASE GB-26 · DUBLIN BUS BOARDS · OPEN</p>
        <p className="tab tab-right">
          <span className="live-dot">●</span> LIVE {time(now, true)} · NTA FEED{" "}
          {feedAge ?? "…"} S OLD
        </p>

        <h1 className="case-title">The Ghost Bus File</h1>

        <section className="exhibit">
          <Paperclip />
          <div className="exhibit-map">
            {live && (
              <CityMap
                buses={live.buses}
                frozen={live.frozen}
                riders={live.riders}
              />
            )}
          </div>
          <p className="exhibit-caption">
            <b>Exhibit A.</b> Dublin&apos;s buses at {live ? time(live.vehiclesAt) : "…"}. Ringed in red: position over 3 minutes old. Blue: ghost bus riders.
          </p>
        </section>

        <section className="sheet">
          <p className="sheet-head">
            Findings at {live ? time(live.tripsAt) : "…"}
          </p>
          {/* the first answer takes a few seconds, because my server asks the nta for every bus in ireland */}
          {!live && (
            <p className="finding-main">
              Opening the case: asking the NTA for every bus in Dublin…
            </p>
          )}
          {live && (
            <>
              <p className="finding-main">
                <span className="marked">
                  {noBus}
                  <MarkerCircle />
                </span>{" "}
                of {live?.shouldBeRunning ?? "…"} trips due on the boards have
                no bus running them.
              </p>
              <p className="stamp">UNVERIFIED</p>

              <ol className="findings">
                <li>
                  <span>2.</span>
                  <span>
                    <b>{frozen}</b> buses shown with a position over 3 minutes
                    old.
                  </span>
                </li>
                <li>
                  <span>3.</span>
                  <span>
                    <b>{buses}</b> Dublin buses on the feed right now.
                  </span>
                </li>
                <li>
                  <span>4.</span>
                  <span>
                    <b>{riders}</b> witnesses on the ground with ghost bus.
                  </span>
                </li>
              </ol>

              <div className="log">
                <p className="log-head">
                  On the boards now, with no bus running them:
                </p>
                {live?.noBusExamples.slice(0, 3).map((trip, i) => (
                  <p key={i} className="log-row">
                    <span>{trip.start}</span>
                    <span>{trip.route}</span>
                    <span className="no-bus">NO BUS</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </section>

        <p className="source">
          Source: NTA GTFS-Realtime vehicle positions and trip updates (CC BY 4.0, provided as is).
        </p>
      </div>
    </main>
  );
}

// when a number changes it gets typed again, one character at a time, like a typewriter
// (no typing if the laptop asks for less motion)
function useTyped(text: string) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    let letters = 0;
    setShown("");
    const timer = setInterval(() => {
      letters++;
      setShown(text.slice(0, letters));
      if (letters >= text.length) clearInterval(timer);
    }, 90);
    return () => clearInterval(timer);
  }, [text]);
  return shown;
}

// a red marker circle drawn around the big number
function MarkerCircle() {
  return (
    <svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M30 22 C70 2, 170 4, 190 40 C204 70, 150 96, 92 95 C36 94, 4 74, 10 46 C14 26, 44 14, 80 10"
        fill="none"
        stroke="#b3312a"
        strokeWidth="4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// the paperclip holding exhibit a to the folder
function Paperclip() {
  return (
    <svg className="paperclip" viewBox="0 0 30 80" aria-hidden="true">
      <path
        d="M10 60 V14 a8 8 0 0 1 16 0 V66 a12 12 0 0 1 -24 0 V22"
        fill="none"
        stroke="#8f8f8f"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
