---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/Recorder.tsx"]
---

# Recorder screen (/)

Mode: Operate. Phone first (Chrome on Android, 390 wide), used on a moving bus, one hand, screen kept on.
Job: start a ride, confirm at a glance that fixes are recording and reaching Firestore, see fix quality and the NTA's claim, stop, download the CSV.
Constraints: the A2 Start / Stop / Download CSV / Clear flow and its 9 CSV columns keep working. Privacy: the rider sees what is shared before Start.
Memorable moment: the amber board says what the NTA claims, the timetable under it shows what the phone measured.
Unresolved: the NTA line is empty until the day-3 function exists; route choice is a free text field (default 7A).

## Direction contract
THESIS: The ride logs itself as a route timetable, every fix a printed row with its cloud mark, while an amber stop board above it carries the official NTA claim. It refuses the category default: a full-bleed map with floating stat cards and a round stop button.
OWN-WORLD: Paper #FBFAF6 ground, ink #15171B, route band ultramarine #2438A8 with a white route block in Barlow Condensed 800, Barlow for everything else, tabular figures everywhere. The board strip alone is black #0C0C0C with amber #FFB000 dot-matrix (Doto). Signal red #C8372D for Stop and the rider's dot, saved green #1D7A46, new-row highlight #FFF4CC. 1px ruled rows, 2px ink rules between regions, no radius, no shadows, no gradients. Night (prefers-color-scheme: dark): black ground, paper text, amber figures.
STORY: The rider sets the route, reads exactly what will be shared, taps Start; on the bus they glance to see recording time, fixes, how many reached the cloud, fix accuracy and where the NTA thinks the bus is; they stop and can download the CSV.
FIRST VIEWPORT: Recording state at 390x844: route band 76px (route block left, status and start time, elapsed clock right); amber board strip one line; three-cell count strip (fixes, in cloud, accuracy); flat map 240px with ultramarine trace and red rider dot; timetable of the latest fixes, newest on top (Time, ±m, km/h, Cloud); dock pinned at the thumb with a full-width red Stop recording and a CSV button.
FORM: Route timetable leaflet, position 4 of my 7. seed: af7d3ffeae9fdef8. Signature interaction: each new fix ticks in at the top of the timetable highlighted, its cloud mark a hollow ring until Firestore confirms the write, then filled, struck through on failure; NTA rows interleave in ultramarine.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
