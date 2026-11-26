---
name: Ghost Bus
description: An open case file against Dublin's bus boards, typed on paper and clipped to a manila folder.
colors:
  desk: "#221d18"
  manila: "#d6bb82"
  manila-edge: "#b99c62"
  paper: "#f4eedf"
  ink: "#1c1a17"
  ink-soft: "#4a443b"
  stamp-red: "#b3312a"
  ok-green: "#2f6b3a"
  witness-blue: "#2438a8"
  board-black: "#0c0c0c"
  board-amber: "#ffb000"
  board-bezel: "#262626"
  dashed-rule: "#b9b09b"
  map-paper: "#f1ead8"
  map-water: "#d9dedb"
  map-label: "#5a5246"
  paperclip-steel: "#8f8f8f"
typography:
  display:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "clamp(36px, 11vw, 56px)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
  stamp:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    letterSpacing: "0.04em"
  body:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.08em"
  board:
    fontFamily: "Doto, monospace"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: 1.5
rounded:
  tag: "4px"
  card: "6px"
  folder: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  folder:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.ink}"
    rounded: "{rounded.folder}"
    padding: "18px 14px 20px"
  folder-tab:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.folder}"
    padding: "7px 14px 0"
    height: "32px"
  paper-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "4px 16px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "12px"
    height: "48px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
    height: "44px"
  choice-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
    height: "48px"
  board-line:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.board-amber}"
    typography: "{typography.board}"
    rounded: "{rounded.card}"
    padding: "8px 10px"
  check-strip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    padding: "6px 10px 8px"
  check-strip-bad:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.stamp-red}"
  check-strip-ok:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ok-green}"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-red}"
    typography: "{typography.stamp}"
    rounded: "{rounded.card}"
    padding: "2px 10px"
  exhibit-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
---

# Design System: Ghost Bus

## Overview

**Creative North Star: "The Open Case File"**

Ghost bus is an open case against the board. Every A4 surface (the cover at `/`, `/stop`, `/ride`, `/live`, `/replay`) is a manila case folder lying on a dark walnut desk: evidence is clipped or laid in as numbered exhibits, the findings are typed on off-white paper in typewriter ink, and a single rubber-stamp red marks what is suspicious and what has been ruled on. The system refuses the dark operations dashboard with KPI tiles; numbers live inside typed sentences, and a big one gets circled in marker rather than boxed in a tile.

Density is that of a real file: one folder fills the viewport, the papers inside sit slightly askew, and nothing floats free of the folder. The projector screen (`/live`, `/replay`) is sized entirely in viewport-height units so the whole file fits one 100vh desk; the phone screens size in pixels with 48px touch targets. The official data appears as "the suspect" in its own clothes: the amber dot-matrix stop board, quoted verbatim, with ghost bus's typed check underneath.

Motion is physical and small: a marker ring drawn by hand, a stamp coming down, a number retyped one character at a time. Each respects reduced motion.

**Key Characteristics:**
- Desk, folder, paper, ink: four material layers, always in that order from back to front.
- Typewriter for every finding; heavy grotesk only for titles and stamps.
- Stamp red is rare and means suspicion or a verdict.
- Evidence is labelled as exhibits (A: the city map, B: the board, C: the ride replay).
- The real board is shown as itself, amber on black, never restyled into the file's palette.

## Colors

A warm, low-saturation paper-and-wood palette with three meaningful inks: red for suspicion, green for cleared, blue for witnesses.

### Primary
- **Rubber-Stamp Red** (stamp-red): the UNVERIFIED and VERIFIED GHOST stamps, the hand-drawn marker rings on frozen buses and around the headline count, "NO BUS" in the typed log, and a check strip whose line has no bus or a frozen one. Also the focus ring and text selection on paper.

### Secondary
- **Cleared Green** (ok-green): the BUS CAME stamp and a check strip where a real bus is behind the board line. The only positive colour in the file.
- **Witness Blue** (witness-blue): ghost bus riders on the city map, as blue ink dots with a paper halo. Carried over from the A3 route trace; it means "a person on the ground", nothing else.

### Tertiary
- **Board Amber on Board Black** (board-amber, board-black, board-bezel): the suspect. Used only to reproduce the official RTPI stop board line by line, in the Doto dot-matrix face, inside a black panel with a 3px inset bezel. Never used for ghost bus's own voice.

### Neutral
- **Walnut Desk** (desk): the full-bleed ground behind the folder on every surface, and the thin case strip above `/ride`.
- **Manila** (manila) and **Manila Edge** (manila-edge): the folder body and its left tab; the darker edge tone is the second (right) tab on the projector.
- **Typed Paper** (paper): case sheets, exhibit prints, the cover index, check strips, exhibit tags.
- **Typewriter Ink** (ink): all body text, the outlined and filled buttons, rules under sheet heads, bus dots on the map.
- **Faded Ink** (ink-soft): captions, meta lines, small print, log headings, LATE and UNCLEAR stamps. Holds over 4.5:1 on paper and on manila.
- **Dashed Rule** (dashed-rule): 1px dashed dividers between findings, verdicts and cover entries.
- **Map Print** (map-paper, map-water, map-label): the base map recoloured as a paper print (see Components).

### Named Rules
**The One Stamp Rule.** Red is for suspicion and verdicts only: a stamp, a marker ring, a NO BUS, a bad check. If a red element is not accusing the board of something, it should be ink. Focus rings and text selection are the one functional exception.

**The Suspect Wears Amber Rule.** Amber on black belongs to the official board and nothing else. Ghost bus never speaks in amber; it types underneath.

## Typography

**Display Font:** Archivo Black (with sans-serif fallback), loaded as `--font-case`
**Body Font:** Courier Prime 400/700 (with Courier New, monospace), loaded as `--font-typed`
**Board Font:** Doto 900, loaded as `--font-doto`, for the stop board only

**Character:** A heavy poster grotesk stencilled on the folder against a typewriter that types every finding. The pairing reads as a case title on the cover and testimony on the sheet. Barlow and Barlow Condensed are A3 legacy faces; under the case world they are remapped to the typewriter and the grotesk.

### Hierarchy
- **Display** (Archivo Black, clamp 36–56px phone / 6.4vh projector, line-height 0.95–1, uppercase, -0.02em): the case title, "The Ghost Bus File", once per surface.
- **Headline** (Archivo Black, 30px, 1.05, uppercase): the stop name on `/stop`.
- **Title** (Archivo Black, 24px, uppercase): cover index entries.
- **Stamp** (Archivo Black, 19px phone / 2.6–3.6vh projector, 0.04–0.06em tracking, uppercase): stamps only.
- **Finding** (Courier Prime 700, 3.6vh, 1.15): the main typed sentence on the projector sheet; the count inside it rises to 8.5vh.
- **Body** (Courier Prime 400, 17px, 1.45, max 46ch): ledes and running text. Sheet findings are 2.4vh at 1.35.
- **Body small** (Courier Prime 400, 14px, 1.35): check strips, small print, captions (2vh on the projector).
- **Label** (Courier Prime 700, 13px / 1.8vh, 0.08em, uppercase): folder tab text and the scene switches.
- **Board** (Doto 900, 20px, 1.5): board lines in a three-column grid (route, destination, minutes).

### Named Rules
**The Typed Testimony Rule.** Every number and finding is set in the typewriter, inside a sentence. Archivo Black is for titles and stamps, never for data.

**The Retype Rule.** A live number that changes is retyped one character at a time (90ms per character), never counted up or cross-faded.

## Layout

Every surface is desk, then one folder, then papers. On the projector the desk is a fixed 100vh with 5vh top padding (room for the tabs) and the folder is a three-row grid: case title across the top, Exhibit A (1.55fr) beside the case sheet (1fr) with a 2.5vw gap, and a source line across the bottom carrying the scene switches. On phones the desk pads 44px top and 12px sides, the folder pads 18px 14px 20px, and content stacks in one column; the cover folder caps at 560px and centres.

Spacing on phones runs on a 4px base (4, 8, 12, 16, 24 most often; 6 and 10 appear inside tight strips). The projector scales the same rhythm in vh (0.6, 1.2, 2.4vh). Board lines stack with their check strip directly underneath and no gap; entries separate by 4px and strips by 10px.

## Elevation & Depth

Depth is physical: paper casts soft ambient shadows on the folder, the folder casts a deeper one on the desk, and paper sits slightly rotated as if laid down by hand. There are no hard offset shadows and no glows.

### Shadow Vocabulary
- **Folder on desk** (`box-shadow: 0 12px 30px rgb(0 0 0 / 0.45)`; projector `0 1.5vh 4vh`): the folder only.
- **Paper on folder** (`box-shadow: 0 6px 16px rgb(0 0 0 / 0.25)`; projector `0 0.6vh 1.6vh rgb(0 0 0 / 0.28)`): exhibit prints, case sheets, the cover index.
- **Tag on print** (`box-shadow: 0 0.3vh 0.8vh rgb(0 0 0 / 0.2)`): exhibit tags on the map.
- **Board bezel** (`box-shadow: inset 0 0 0 3px #262626`): the stop board panel.

### Named Rules
**The Laid-Down Rule.** Loose papers on the projector tilt a fraction (exhibit -0.6deg, sheet +0.5deg); stamps tilt hard (-3 to -11deg) and multiply into the paper. Phone papers stay straight so typed text stays easy to read on a moving bus.

## Shapes

Corners are barely softened, like card stock: 6px on paper, buttons and the board, 8px on the folder, 4px on exhibit tags. The folder keeps its top-left corner square where the tab joins it, and tabs round only their top corners. Strokes are ink: 1.5px on choice rows and tags, 2px on outlined buttons and the sheet-head rule, 4px on stamps. Hand-drawn shapes (marker rings, the paperclip) are SVG paths with round caps, never perfect circles.

## Components

### Buttons
Typed labels on card, tactile and plain.
- **Filled ink** (button-ink): ink fill, paper text, Courier Prime 700 17px, full width, 48px minimum, 6px corners. The primary action on a phone ("Find my stop"); on the projector the first replay control. Disabled at 60% opacity with a wait cursor.
- **Outlined ink** (button-outline): 2px ink border, ink text, transparent, 44px minimum. Secondary actions ("It didn't come", the other replay controls, scene links).
- **Scene switch**: 1.5px ink-soft outline, uppercase label type; the active one fills with ink and paper text.
- **Text link button**: underlined typewriter text with 3px offset, 44px tall ("Change stop").
- **Focus:** 3px stamp-red outline at 2–3px offset.

### Choice rows
A paper row with a 1.5px ink border, 48px tall, name on the left and distance in ink-soft on the right. Used for picking a nearby stop.

### Folder and tabs (signature)
The manila folder fills the desk. Tabs stick out above its top edge (`top: -30px` phone, `-3.6vh` projector), carry the case reference in label type ("CASE GB-26 · AT THE STOP"), and on the projector a second darker tab at the top right holds the live clock and feed age.

### Exhibit print with paperclip (signature)
A paper sheet holding the map, padded 1.2vh, tilted -0.6deg, with a steel-grey SVG paperclip (3.5px stroke, round caps) breaking over its top edge at 12% from the left. A caption below in ink-soft opens with the exhibit name in bold ink ("**Exhibit A.**") and states what the marks mean.

### Typed case sheet
Paper, tilted +0.5deg on the projector, headed by an ink-soft line over a 2px ink rule. Holds one finding sentence with a marker-ringed count, a stamp, findings separated by dashed rules, and a typed log of board trips in a fixed-width grid (7ch time, 7ch route, then NO BUS right-aligned in red).

### Rubber stamp (signature)
Archivo Black, uppercase, a 4px (0.4–0.5vh) border in currentColor, 6px corners, rotated, `mix-blend-mode: multiply`. Colour carries the verdict: VERIFIED GHOST and UNVERIFIED in stamp red, BUS CAME in ok green, LATE, NOT A GHOST and UNCLEAR in ink-soft. Comes down with a 0.35s stamp-down (scale 1.25 to 1, fade in) on the newest verdict.

### Amber board line and typed check strip (signature)
The board line reproduces the real stop board: black panel, amber Doto, route / destination (ellipsised) / minutes ("Due" under a minute). Directly beneath, a paper strip with square top corners types what ghost bus found: ink when nothing is known yet, ok green when a bus is behind it, stamp red and bold when there is no bus, it is frozen, or it is cancelled. A verdict replaces the strip's text with a stamp and the reason.

### Exhibit tag with leader line
On the map print: a 3vw, 2px ink leader line from the bus, then a paper label with a 1.5px ink border, 4px corners and bold typed text ("39A · 14 MIN OLD"). At most three, on the oldest frozen buses in view, never two within 1.5km.

### Map print
Base map recoloured as a paper print: paper ground, pale grey-green water, roads and fills in warm greys, labels in map-label with a paper halo; POIs, house numbers and road shields removed. Buses are 2.6px ink dots at 75% opacity; frozen buses get a hand-drawn red marker ring (draws in over 0.9s with `cubic-bezier(0.16, 1, 0.3, 1)` when newly frozen, appears at once on first load); riders are 8px witness-blue dots with a 2.5px paper stroke. The projector map is not interactive.

### Navigation
The cover index is the file's table of contents: a paper card of three typed entries split by dashed rules, each wholly a link with an Archivo Black title and an ink-soft line of what it does. The folder tab's case reference links home on `/ride`.

## Do's and Don'ts

### Do:
- **Do** keep the four layers in order on every new surface: desk, one manila folder with a tab, paper, ink.
- **Do** type every finding and number in Courier Prime inside a full sentence, and retype changed numbers character by character.
- **Do** name evidence as exhibits in captions ("Exhibit A.", bold ink) and say what each mark means.
- **Do** show the official board as amber Doto on black, with ghost bus's typed check directly underneath.
- **Do** colour stamps by verdict: red for ghost or unverified, green for bus came, ink-soft for late or unclear.
- **Do** keep 48px touch targets on phone screens and honour `prefers-reduced-motion` for the ring, the stamp and the retyping.

### Don't:
- **Don't** use stamp red for anything that is not suspicion or a verdict (live indicators, hover states, counts, generic errors, the rider's own position).
- **Don't** use amber for ghost bus's own text or controls; it belongs to the board.
- **Don't** build KPI tiles, dashboard cards or a dark ops panel; findings are typed on paper.
- **Don't** repeat defensive copy (the same caveat or "unverified" explanation on several elements of one screen); say it once, where it applies.
- **Don't** use glyph icons (arrows, ticks, crosses, emoji); marks are drawn as SVG strokes or said in words.
- **Don't** use hard offset shadows or glows; paper casts soft ambient shadows only.
- **Don't** set data in Archivo Black or titles in the typewriter.
