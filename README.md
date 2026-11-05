# Ghost bus

A phone web app that records where a Dublin bus really is, from a rider on board, and puts it next to the NTA's live bus feed in the cloud. The goal is to catch "ghost buses": the ones the real-time boards say are coming when they aren't.

**Live:** https://ghost-bus-a3.vercel.app (open it in Chrome on an Android phone)

## What it does

- Records the phone's GPS about once a second while you ride (the browser's Geolocation API), and shows it as a live timetable plus a map.
- Sends every fix to **Cloud Firestore** the moment it's recorded. Each row shows a cloud mark: hollow while waiting, filled once Google has it. With no signal, fixes wait in a local cache and go up when it's back, even across a reload.
- Once a minute while recording, a server function fetches the **NTA GTFS-Realtime** vehicle feed, saves it to Firestore, and the page shows the live buses of your route on an amber "stop board" and on the map.
- The CSV download from the first version still works.

## Built with

Next.js 16 (App Router, React, TypeScript, Tailwind), Firebase (Firestore, anonymous Authentication, firebase-admin on the server), MapLibre GL with OpenFreeMap tiles, deployed on Vercel.

| Part | File |
| --- | --- |
| The recorder screen | `app/Recorder.tsx` |
| The map | `app/RideMap.tsx` |
| Saving rides and fixes to Firestore | `app/cloud.ts`, `app/firebase.ts` |
| One GPS fix, and the CSV row | `app/toRow.ts` |
| The NTA feed function (runs on the server) | `app/api/nta/route.ts` |
| Who may write what in the database | `firestore.rules` |
| The official 7A route line (TFI timetable) | `public/routes/7A.json` |

## Run it yourself

1. A Firebase project with **Cloud Firestore**, **Anonymous** sign-in turned on, and the rules from `firestore.rules` published. Put the project's web config in `app/firebase.ts`.
2. An NTA developer key (developer.nationaltransport.ie, GTFS-Realtime) and a Firebase **service account** key (Project settings → Service accounts).
3. A `.env.local` file with two variables (never commit it):
   - `NTA_KEY` — the NTA key
   - `FIREBASE_SERVICE_ACCOUNT` — the service account JSON, on one line
4. `npm install`, then `npm run dev`, and open http://localhost:3000. Location only works on `localhost` or HTTPS.
5. To put it online: `npx vercel --prod`, with the same two variables added in Vercel.

## Data and credits

- Live bus positions: National Transport Authority, GTFS-Realtime, CC BY 4.0. Route line: TFI GTFS timetable.
- Map: © OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors.

## Status

Built for CS7NS4 Urban Computing at Trinity College Dublin. The phone recorder came first (tag `a2-submitted`), then the cloud upload and the NTA feed. Next: several riders at once, and comparing riders with the NTA feed.
