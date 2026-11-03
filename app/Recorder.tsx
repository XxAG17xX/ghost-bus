"use client";

import { useEffect, useRef, useState } from "react";
import { HEADER, toRow } from "./toRow";

// Rows are also kept in the phone's browser storage, so a reload mid-ride loses nothing.
const KEY = "ghost-bus-rows";

export default function Recorder() {
  const [rows, setRows] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const watchId = useRef<number | null>(null);

  // Once, after the page opens: bring back rows saved before a reload.
  useEffect(() => {
    // Browser storage doesn't exist during the server render, so it can only be read here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  }, []);

  function onPosition(p: GeolocationPosition) {
    setError("");
    setRows((old) => {
      const next = [...old, toRow(p)];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  function start() {
    setError("");
    watchId.current = navigator.geolocation.watchPosition(
      onPosition,
      (e) => setError(e.message),
      // timeout: say so after 15 s without a position, instead of waiting silently forever
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    setRecording(true);
  }

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setRecording(false);
  }

  function download() {
    const csv = [HEADER, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ride-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clear() {
    if (!confirm(`Delete all ${rows.length} rows? Download them first.`)) return;
    localStorage.removeItem(KEY);
    setRows([]);
  }

  const button = "rounded border px-4 py-2 disabled:opacity-40";
  return (
    <div className="flex flex-col gap-3">
      <p>{recording ? "Recording..." : "Stopped"} · {rows.length} rows</p>
      <div className="flex gap-2">
        <button className={button} onClick={start} disabled={recording}>Start</button>
        <button className={button} onClick={stop} disabled={!recording}>Stop</button>
        <button className={button} onClick={download} disabled={rows.length === 0}>Download CSV</button>
        <button className={button} onClick={clear} disabled={recording || rows.length === 0}>Clear</button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <p className="break-all font-mono text-xs">{rows.at(-1)}</p>
    </div>
  );
}
