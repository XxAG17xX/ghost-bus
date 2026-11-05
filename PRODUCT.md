# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: a rider on a Dublin bus recording the ride on their phone in Chrome. Right now that's me (Kartik), classmates and demo guests. They stand or sit, often use one hand, keep the screen on with Chrome in front for the whole ride (a hidden page gets no new positions), and glance at the screen rather than read it.
Secondary: the lecturer or TA at the demo, who has to see at a glance that the recording works and that the data reaches the cloud in real time.

## Product Purpose
Catch ghost buses. Dublin's real-time boards often say a bus is coming and then it never comes. Phones on the bus record where it really is, and that is checked against the NTA's live bus feed (GTFS-Realtime), so it shows when the official data is wrong or late.
Success for Assignment 3: every GPS row reaches the cloud database (Firebase Firestore) seconds after it's recorded, and the live NTA positions of the same route land next to it. Success later (Assignment 4): several riders at once, and a comparison of what the phones saw with what the feed claimed.

## Positioning
The ground truth comes from riders on the bus itself, not from the operator's own tracker. Apps like Google Maps and TFI Live show the official feed; this product checks it.

## Operating Context
- Used on real rides; the first route is the 7A (O'Connell Street to Lansdowne Park and back).
- The NTA feed can only be asked once a minute, and its vehicle positions are typically a few tens of seconds old (live test 18 Oct 2026: median age 22 s, worst 17 min). So the official bus usually appears behind the rider, and comparisons are made at the feed's own timestamps, not at "now".
- Shown at the end-of-term demo, and screenshots and a demo video go in the reports, README and CV.

## Capabilities and Constraints
- Next.js 16 (App Router, React, TypeScript, Tailwind) deployed on Vercel; Firebase Firestore (Spark plan) as the database.
- Must keep: the Assignment 2 flow (Start, Stop, Download CSV with the 9 columns of A2's Table 1) keeps working.
- Free plans only: Firebase Spark and Vercel Hobby; no paid services, no card.
- The NTA key stays server-side (a Vercel environment variable), never in the page.
- The Assignment 2 site at ghost-bus-lemon.vercel.app stays frozen; Assignment 3 deploys to a separate Vercel project.
- Undecided: the final product name ("Ghost bus" is the working name, not binding); whether riders sign in (anonymous auth) before Assignment 4.

## Evidence on Hand
- Two real 7A rides from 24 Oct 2026 (2,744 rows) and their analysis in `Z:\Urban Computing\Assignment 2\report` (median accuracy ±4.7 m, about one row per second).
- A phone screenshot of the A2 recorder: `Z:\Urban Computing\Assignment 2\report\figures\phone_recorder.png`.
- No riders other than me yet, no testimonials, no ghost-bus cases proven yet. Don't invent any.

## Product Principles
1. The rider's glance comes first: the state (recording, saved to the cloud, last NTA update) must be readable in a second on a moving bus.
2. Show the truth as it is: raw values, honest gaps and delays, no smoothing that hides a problem.
3. Privacy first: the rider can always see what is being shared, and ride starts and ends are trimmed so a trace never shows where anyone lives.
4. Never lose a ride: rows are kept on the phone even when the upload fails, and sent when the connection is back.

## Accessibility & Inclusion
Readable in daylight on a bus and with one hand: large touch targets, strong contrast, and reduced-motion respected.
