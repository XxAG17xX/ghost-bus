"use client";

import { useEffect } from "react";
import Recorder from "../Recorder";

// "i'm on a bus": the recorder from assignments 2 and 3, now in the case file look
export default function RidePage() {
  // the case file colours and fonts for the whole page, the map reads them from here too
  useEffect(() => {
    document.documentElement.classList.add("case-world");
    return () => document.documentElement.classList.remove("case-world");
  }, []);
  return <Recorder />;
}
