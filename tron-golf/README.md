# TRON GOLF — V1

Mobile-first golf GPS and score tracker. Offline-first, retro pixel interface,
real satellite imagery on the playing map.

## Run it

Two commands, from this folder:

```powershell
npm install
npm run dev
```

Then open the printed `http://localhost:5173` URL. On a phone, use the
`Network:` address Vite prints and make sure the phone is on the same Wi-Fi.
Browser geolocation needs `localhost` or HTTPS, so for on-course GPS testing
build once (`npm run build`) and serve `dist/` over HTTPS.

## Map configuration

No API key is required. The playing map uses **Esri World Imagery** — genuine
satellite/aerial tiles, attribution rendered on the map.

To switch to Mapbox instead, create `.env.local`:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

The provider is picked up automatically at build time (`src/map/provider.ts`).
Google imagery is deliberately not wired in: it may only be served through the
authorised Google Maps JavaScript API, so no Google tiles or branding appear
anywhere in the app.

## Architecture

```
src/
  theme/       tokens.css      palette, typography, spacing, border geometry
               components.css  header, panel, button, nav, table, stepper
  components/  Screen.tsx      header + body + bottom nav used by every screen
               ui.tsx          Button, Panel, KV, Stepper, Segmented, Toggle
               icons.tsx       8x8 pixel icon family
  map/         SatelliteMap    Leaflet wrapper over real satellite tiles
               provider.ts     tile provider selection + preview tile URLs
  state/       types.ts        Course, Hole, Round, HoleScore, Settings
               store.ts        state + localStorage persistence + derived totals
               geo.ts          haversine distance, bearings, unit formatting
               seed.ts         Kinrara Golf Club + hole generation
  screens/     Menu, Courses, AddCourse, RoundSetup, HoleSelect, PlayMap,
               ScoreEntry, Scorecard, RoundComplete, History, Settings
```

State lives in one small external store (`src/state/store.ts`) read through
`useSyncExternalStore`. Every mutation writes straight through to
`localStorage` under the key `tron-golf:v1` — no cloud, no accounts.

## Screens and flow

`Menu → Courses → Course detail → Round setup → Hole selector → Playing map →
Score entry → (next hole) … → Round complete → Round history`

- Hole selection is manual throughout — arrows move between holes 1–18.
- Default tee is Blue.
- Scores persist the moment `SAVE & NEXT` is pressed.
- An unfinished round found on start-up is offered back via `RESUME ROUND`.
- Completed rounds move into Round History with their scorecard.

## Course coordinates

Kinrara Golf Club ships with real pars, stroke indexes and Blue/White/Red
distances. Its per-hole tee and green coordinates are **derived around the
club's location, not surveyed**, so the map has reference points from the first
run; they are flagged `approximateCoords` in the data and noted in the UI.
Courses added through `ADD COURSE` are generated the same way from the pin you
drop. The satellite imagery underneath is always the provider's real tiles.

## Smoke test

With the app built and previewing (`npm run build && npm run preview`):

```powershell
npm run smoke
```

Drives the full acceptance journey in a 390x844 viewport and writes
screenshots to `shots/`. Requires `playwright` (already a dev dependency) and a
Chromium install.

## Not in V1

Handicap allowances (WHS/MGA), shot-by-shot tracking, analytics, cloud sync,
accounts and multiplayer are deliberately out of scope.
