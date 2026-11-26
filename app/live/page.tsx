"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
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
  reports: { route: string; stopName: string; verdict: string; reason: string; witnesses: number; at: number; demo: boolean }[];
};

// the right-hand sheet has three pages, switched with the tabs or the keys 1, 2, 3 during the demo
type Scene = "findings" | "join" | "verdicts";
const STAMPS: Record<string, string> = { ghost: "VERIFIED GHOST", came: "BUS CAME", late: "LATE, NOT A GHOST", unclear: "UNCLEAR" };
const DEMO_STOP = "8220DB000404"; // nassau street, next to trinity, for the classroom

// the projector screen for the demo: dublin's buses as an open case file, live from the nta
export default function LivePage() {
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [scene, setScene] = useState<Scene>("findings");
  const [qr, setQr] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const newestReport = useRef<number | null>(null);
  const router = useRouter();

  // ask my server every 20 s (it only calls the nta once a minute).
  // when a new verdict comes in, the sheet jumps to the verdicts by itself
  useEffect(() => {
    async function ask() {
      const response = await fetch("/api/live");
      if (!response.ok) return;
      const data: Live = await response.json();
      const newest = data.reports[0]?.at ?? 0;
      if (newestReport.current !== null && newest > newestReport.current) setScene((now) => (now === "join" ? now : "verdicts"));
      newestReport.current = newest;
      setLive(data);
    }
    ask();
    const timer = setInterval(ask, 20_000);
    return () => clearInterval(timer);
  }, []);

  // the qr code sends classmates to the demo stop on their phones (?stop=... can change it)
  useEffect(() => {
    const stop = new URLSearchParams(window.location.search).get("stop") ?? DEMO_STOP;
    const link = `${window.location.origin}/stop?stop=${stop}&demo=1`;
    QRCode.toString(link, { type: "svg", margin: 0, color: { dark: "#1c1a17", light: "#f4eedf" } }).then((svg) => {
      setQr(svg);
      setJoinLink(link.replace(/^https?:\/\//, ""));
    });
  }, []);

  // keys 1, 2, 3 switch the sheet, so i don't need the mouse during the demo
  useEffect(() => {
    const keys: Record<string, Scene> = { "1": "findings", "2": "join", "3": "verdicts" };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "4") router.push("/replay"); // the replay of my real ride
      else if (keys[e.key]) setScene(keys[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

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
        <Link href="/" className="tab tab-left">CASE GB-26 · DUBLIN BUS BOARDS · OPEN</Link>
        <p className="tab tab-right">
          <span className="live-dot" aria-hidden="true" /> LIVE {time(now, true)} · NTA FEED{" "}
          {feedAge ?? "…"} S OLD
        </p>

        <h1 className="case-title">The Ghost Bus File</h1>

        <section className="exhibit">
          <Paperclip />
          <div className="exhibit-map">
            <CityMap
              buses={live?.buses ?? []}
              frozen={live?.frozen ?? []}
              riders={live?.riders ?? []}
            />
          </div>
          <p className="exhibit-caption">
            <b>Exhibit A.</b> Dublin&apos;s buses at {live ? time(live.vehiclesAt) : "…"}. Ringed in red: position over 3 minutes old. Blue: ghost bus riders.
          </p>
        </section>

        <section className="sheet">
          <p className="sheet-head">
            {scene === "join" ? "Witnesses" : scene === "verdicts" ? "Verdicts" : "Findings"} at {live ? time(live.tripsAt) : "…"}
          </p>
          {/* the first answer takes a few seconds, because my server asks the nta for every bus in ireland */}
          {!live && (
            <p className="finding-main">
              Opening the case: asking the NTA for every bus in Dublin…
            </p>
          )}
          {live && scene === "join" && (
            <div className="join">
              <p className="finding-main">Be a witness.</p>
              <p className="join-what">Scan this. Your phone shows the board at the stop, and what is really behind each line.</p>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="join-link">{joinLink}</p>
              <p className="join-count">
                <b>{riders}</b> {live.riders.length === 1 ? "witness" : "witnesses"} connected
              </p>
            </div>
          )}
          {live && scene === "verdicts" && (
            <div className="verdicts">
              {live.reports.length === 0 && <p className="join-what">No reports yet. Press &quot;It didn&apos;t come&quot; on a line that&apos;s overdue.</p>}
              {live.reports.map((r, i) => (
                <div key={i} className="verdict-entry">
                  <p className={`verdict-stamp-live ${r.verdict}`}>{STAMPS[r.verdict]}</p>
                  <p className="verdict-what">
                    <b>{r.route}</b> at {r.stopName} · {time(r.at)}
                    {r.witnesses > 1 && ` · ${r.witnesses} witnesses`}
                    {r.demo && " · demo stop"}
                  </p>
                  <p className="verdict-why">{r.reason}</p>
                </div>
              ))}
            </div>
          )}
          {live && scene === "findings" && (
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
                  <span>
                    <b>{frozen}</b> buses shown with a position over 3 minutes
                    old.
                  </span>
                </li>
                <li>
                  <span>
                    <b>{buses}</b> Dublin buses on the feed right now.
                  </span>
                </li>
                <li>
                  <span>
                    <b>{riders}</b> {live.riders.length === 1 ? "witness" : "witnesses"} on the ground with ghost bus.
                  </span>
                </li>
              </ol>

              <div className="log">
                <p className="log-head">
                  On the boards now, with no bus running them:
                </p>
                {live?.noBusExamples.slice(0, 2).map((trip, i) => (
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

        <div className="source">
          <p>Source: NTA GTFS-Realtime vehicle positions and trip updates (CC BY 4.0, provided as is).</p>
          <p className="scene-tabs">
            {(["findings", "join", "verdicts"] as Scene[]).map((name, i) => (
              <button key={name} onClick={() => setScene(name)} className={scene === name ? "on" : ""}>
                {i + 1} {name}
              </button>
            ))}
            <Link href="/replay">4 replay</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// when a number changes it gets typed again, one character at a time, like a typewriter
// (no typing if the laptop asks for less motion)
function useTyped(text: string) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let letters = quick ? text.length - 1 : 0;
    const timer = setInterval(() => {
      letters++;
      setShown(text.slice(0, letters));
      if (letters >= text.length) clearInterval(timer);
    }, quick ? 0 : 90);
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
