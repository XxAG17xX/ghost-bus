---
version: 1
slug: "app-live-page-tsx"
primary_target: "app/live/page.tsx"
related_targets: ["app/live/CityMap.tsx"]
---

# /live: the projector screen

Scope: the demo projector screen (Persuade). Seen from the back of a classroom on a laptop-driven projector, for the 2-minute demo. Later the phone screens (waiting at a stop, riding, verdicts) reuse the same world.

Audience and job: classmates and the lecturer. In 20 seconds they must understand that the NTA's own live data shows trips on the boards with no bus behind them and bus positions that are minutes old, that this is happening right now, and that ghost bus collects proof. Action: scan the QR code and join as a witness (added in a later step).

Proof: only real numbers from /api/live (the NTA's GTFS-Realtime positions and trip updates, checked every minute). No invented claims. Ghost candidates are labelled UNVERIFIED until riders confirm them.

Chosen: Kartik let Claude pick ("go with your best choice"), to be judged on localhost. Pick card, the case file.

## Direction contract

THESIS: Ghost bus is an open case against the board. The screen is a case file on a desk, not a dashboard: the city is clipped in as Exhibit A and the findings are typed on the case sheet. It refuses the dark ops dashboard with KPI tiles.

OWN-WORLD: Dark walnut desk ground, a manila folder with a tab, off-white typed paper, black typewriter ink, one rubber-stamp red for suspicion and verdicts. Heavy grotesk for the case title, a typewriter face for every finding, exhibit tags with string-tag shape and leader lines. The map is printed on paper: light, ink roads, buses as ink dots, frozen buses circled in red marker.

STORY: The room sees a live case: 307 board trips with no bus, 46 frozen positions, typed and stamped UNVERIFIED. They understand the official feed is being checked against reality and that their phones could be the witnesses.

FIRST VIEWPORT: Full-bleed desk. The open folder fills it. Left 60%: Exhibit A, the Dublin map print with a paperclip, red rings on frozen buses and three exhibit tags on the oldest. Right 40%: the case sheet, a huge typed count of trips with no bus, a red UNVERIFIED stamp, three typed findings and a short typed log of board trips with no bus. Folder tab top-left with the case name; top-right tab with the live clock and feed age.

FORM: the case file, my top-ranked grounded direction (position 1 of 7), seed:5a371f5a06bab432. Signature interaction: a newly frozen bus gets its red marker ring drawn by hand on the map; numbers retype when they change.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

SCOPE NOTE (26 Nov, after the finish review): the same case-file world now covers every A4 surface: / (cover), /stop, /ride, /live and /replay. The older recorder brief (app-page-tsx.md) describes the A3 look and is superseded for /ride.
