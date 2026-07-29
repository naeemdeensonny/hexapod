# TRON Golf — Handoff Memo

**Date:** 2026-07-29 (fourth session update)
**Repo:** `naeemdeensonny/hexapod`, subfolder `tron-golf/`
**Branch:** `claude/tron-golf-v1-ui-xnoqs6`
**Latest commit:** `7081701`

---

## 1. What the project is

Mobile-first golf GPS + scorecard app with a retro TRON/neon pixel aesthetic.
Runs as a web app / PWA, wrapped with Capacitor into an Android APK for
personal sideloading (no Play Store).

**Stack**

| Layer | Choice |
|---|---|
| Build | Vite 5, TypeScript 5, React 18 |
| Routing | React Router v6, `HashRouter` |
| State | `useSyncExternalStore` + localStorage write-through, key `tron-golf:v1` |
| Maps | `@googlemaps/js-api-loader`, satellite tiles, `map.setHeading()` for rotation |
| PWA | `vite-plugin-pwa` (Workbox) |
| Native | Capacitor 8, appId `com.tronn.golf` |

**Working features:** course CRUD, per-hole tee/green placement on satellite map,
auto-measured distances, scorecard, round history, settings, play map with GPS
tracking and rotation-to-hole.

---

## 2. THE PROBLEM — read this first

### What the phone shows right now (screenshot at 15:41, 2026-07-29)

The hole editor (`/courses/edit/:courseId/hole/:n`) shows:
- "PIN POINTS" heading
- "Select which pin map taps move, then tap the satellite image." helper text
- "TAP TO EDIT" button on the green coord row
- "HOLE DATA" section with PAR/STROKE INDEX steppers
- **No visible map** — map collapses to ~20px

### What the repo actually contains (correct, never run on phone)

`src/screens/HoleEditor.tsx` in the repo has been fully rewritten:
- No "PIN POINTS" heading
- No helper text
- No "HOLE DATA" section
- Map in `.hedit__map` div (CSS: `flex: 1 1 0; min-height: 200px`)
- Controls in `.hedit__body` div (scrollable, `flex: 0 0 auto`)
- Segmented TEE/GREEN toggle at top of controls
- Compact CoordRow with just lat/lng inputs
- PAR + INDEX side by side in btn-row
- PREV / FENCE / NEXT row
- SAVE HOLE button

### Why the phone has never run this code

**The user's local Windows copy (`C:\Users\Naeem Deen\tron-golf-tmp\tron-golf`) is out of sync with the repo.**

Evidence: the screenshot at 15:41 still shows "PIN POINTS" and the helper text.
Both were deleted from HoleEditor.tsx in commit `df6000e` (days ago). The user
ran `git pull` + `npm run build` + `.\gradlew clean assembleDebug` today, but the
built APK still has the old layout. This means `git pull` did not overwrite the
local `src/screens/HoleEditor.tsx` — either there is a local uncommitted
modification, a merge conflict, or the pull failed silently.

### THE FIRST THING TO DO — use `reset --hard`, not `pull`

`git pull` has repeatedly failed to update this working copy (local edits, wrong
branch, or a silently-failed merge — never diagnosed). Stop using it. This
forces every tracked file to match the remote exactly and cannot silently
no-op. Gitignored files (`.env.local`, `android/local.properties`) survive it.

```
cd "C:\Users\Naeem Deen\tron-golf-tmp\tron-golf"
git fetch origin claude/tron-golf-v1-ui-xnoqs6
git reset --hard origin/claude/tron-golf-v1-ui-xnoqs6
```

**Then verify the new code actually landed — do not skip this:**

```
findstr /C:"PIN POINTS" src\screens\HoleEditor.tsx
```

Must print **nothing**. If it prints a line, the working copy is still stale and
nothing downstream matters — stop and fix the checkout before building.

If that directory turns out not to be a git clone of `hexapod` at all (the
`git fetch` errors), re-clone into a fresh folder and restore the two
gitignored files:

```
git clone https://github.com/naeemdeensonny/hexapod.git C:\tron\hexapod
cd C:\tron\hexapod
git checkout claude/tron-golf-v1-ui-xnoqs6
cd tron-golf
echo VITE_GOOGLE_MAPS_KEY=AIzaSyCIrOP4dgGHdOpNW_JIGkpdvkxoA80q1NA> .env.local
echo sdk.dir=C:\\Users\\Naeem Deen\\AppData\\Local\\Android\\Sdk> android\local.properties
```

### Then build

```
npm install
npm run build
npx @capacitor/cli sync
cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
.\gradlew clean assembleDebug
```

**UNINSTALL the old app from the phone first** (long-press → Uninstall — do not
install over the top; WebView storage survives that). Then install
`android\app\build\outputs\apk\debug\app-debug.apk`.

Open app → footer must read `V1 · OFFLINE-FIRST · BUILD 07-29 HH:MM` with
today's date. Then open a hole in the editor.

---

## 3. CSS layout fix — DONE and VERIFIED (commit `7081701`)

The map height used to depend on two things Android WebView does not resolve
reliably:

1. `flex: 0 0 44vh` — `vh` is the **large-viewport** unit in Chrome/WebView
2. `.hedit { height: 100% }` — needs an unbroken chain of resolved percentage
   heights from `html` all the way down, which the WebView does not guarantee

Both dependencies are now gone. Final rules:

`src/theme/tokens.css`:
```css
:root { --map-h: 260px; }
@media (min-height: 700px) { :root { --map-h: 320px; } }
@media (min-height: 820px) { :root { --map-h: 380px; } }
@media (min-height: 950px) { :root { --map-h: 440px; } }
```

`src/theme/components.css`:
```css
.screen-body       { flex: 1; min-height: 0; overflow-y: auto; }
.screen-body.flush { padding: 0; gap: 0; overflow: hidden; }

/* flex ITEM of .screen-body — never `height: 100%` */
.hedit { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

/* absolute px + flex-shrink:0 — flex negotiation cannot touch it */
.hedit__map  { flex: 0 0 auto; height: var(--map-h); min-height: var(--map-h); }

/* takes the remainder and scrolls internally */
.hedit__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
```

`.play` / `.play__map` got the same treatment.

**Verified in headless Chromium** at four viewports with the real production
build. Measured `.hedit__map` heights:

| Viewport | map height | nav overlap | SAVE HOLE |
|---|---|---|---|
| 412×915 | 380px | none | reachable |
| 412×968 | 440px | none | reachable |
| 360×640 | 260px | none | reachable |
| 412×560 (deliberately squashed) | 260px | none | reachable |

Media queries on `min-height` read the real viewport and need no percentage
chain, so they degrade to the 260px floor rather than to zero.

---

## 4. Fixes already made and confirmed (all pushed)

### 4.1 System bars overlapping app — FIXED

`targetSdk 36` forces edge-to-edge. Android WebView never populates CSS
`env(safe-area-inset-*)`. Fixed natively in `MainActivity.java`:

```java
View content = findViewById(android.R.id.content);
ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
    Insets bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
    );
    view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
    return WindowInsetsCompat.CONSUMED;
});
```

`android:windowBackground` = `#050A12` in `styles.xml`. **User confirmed working.**

### 4.2 Service worker poisoning native app — FIXED

`vite-plugin-pwa` was auto-injecting a service worker that Workbox used to
cache the entire app into WebView storage — which Android does NOT clear when
installing a new APK over an old one. Fix: `injectRegister: null` in
`vite.config.ts`; conditional registration in `src/main.tsx`; native purge on
startup. **Phone must be FULLY UNINSTALLED once to clear old cache.**

### 4.3 Play map GPS + on-map labels — built, unconfirmed on device

- 8-bit pixel-art golf ball as GPS marker (`GOLF_BALL_SVG` in `src/map/GoogleMap.tsx`)
- Two white polylines on map: tee→you and you→green, each with white chip
  distance label at midpoint (`distanceLabelIcon()`)
- Bottom panel stripped to RE-CENTRE + SCORE only
- RE-CENTRE re-applies heading after `fitBounds` resets to north

### 4.4 Map rotation — needs a Cloud Console step to work at all

**The rotation never worked in any build, on any device.** Not a stale-code
problem: `setHeading()` was called correctly everywhere, but the map was built
**without a Map ID**, so the API rendered a **raster** map. On raster maps
heading is only honoured at 45° imagery zoom levels — at the top-down satellite
view this app uses, `setHeading()` is a silent no-op. No warning, no error.

Rotation requires a **vector** map. Fixed in `eafa3a5`: `GoogleMap.tsx` now
passes `mapId` when `VITE_GOOGLE_MAPS_ID` is set, and all heading changes go
through `faceHeading()` (sets heading immediately *and* once more on `idle`,
because `fitBounds` is async and snaps back to north, yet never fires `idle`
when it changes nothing).

**Remaining manual step — the code cannot do this:**

Google Cloud Console → Google Maps Platform → **Map Management** → Create Map ID
- Map type: **JavaScript**
- Rendering: **Vector** (not Raster)
- Tick **Tilt** and **Rotation**

Then add to `.env.local` and rebuild:
```
VITE_GOOGLE_MAPS_ID=<the map id>
```

Degrades cleanly — with no Map ID the app runs exactly as before, north-up.

Heading itself is `bearing(tee, greenCentre)`, recomputed whenever the hole
changes.

---

## 5. Build environment (Windows — fully set up)

### JDK

JDK 21.0.11.10 (Adoptium Temurin) installed at:
`C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`

JDK 17.0.19.10 also installed but NOT sufficient — Capacitor 8 requires Java 21
(`sourceCompatibility = JavaVersion.VERSION_21`).

User `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
Oracle `java8path` was removed from System PATH.

### Build commands (complete, working sequence)

```
cd "C:\Users\Naeem Deen\tron-golf-tmp\tron-golf"
git pull origin claude/tron-golf-v1-ui-xnoqs6
npm run build
npx @capacitor/cli sync
cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
.\gradlew clean assembleDebug
```

Output: `android\app\build\outputs\apk\debug\app-debug.apk`
Build time: ~24s, 97 tasks. Confirmed `BUILD SUCCESSFUL` today.

### Known traps

| Trap | Fix |
|---|---|
| `npx cap sync` fails | Use `npx @capacitor/cli sync` (full package name) |
| Must run from `tron-golf/` not `android/` | Cap sync reads capacitor.config from project root |
| `.env.local` is gitignored | Must exist locally with `VITE_GOOGLE_MAPS_KEY=AIzaSyCIrOP4dgGHdOpNW_JIGkpdvkxoA80q1NA` |
| Installing over old app | Does NOT clear WebView storage — always UNINSTALL fully first |
| Play Protect blocks install | Tap the **text link** "Install anyway", not the blue OK button |
| Android Studio GUI builds | Were producing cached/stale APKs — use command-line only |

---

## 6. File map

```
tron-golf/
├── capacitor.config.json          # the one Capacitor reads on Windows
├── vite.config.ts                 # PWA, injectRegister:null, __BUILD_ID__
├── .env.local                     # GITIGNORED — VITE_GOOGLE_MAPS_KEY here
├── src/
│   ├── main.tsx                   # SW register (web) / purge (native)
│   ├── theme/
│   │   ├── tokens.css             # sizing/spacing/type tokens
│   │   └── components.css        # .hedit* layout, .play*, nav, panels
│   ├── components/Screen.tsx      # app shell; flush prop removes padding
│   ├── map/GoogleMap.tsx          # GOLF_BALL_SVG, distanceLabelIcon, midpoint
│   └── screens/
│       ├── HoleEditor.tsx         # ← THE SCREEN WITH THE BUG (repo is correct)
│       └── PlayMap.tsx            # GPS, on-map labels, rotation
└── android/
    └── app/src/main/
        ├── java/com/tronn/golf/MainActivity.java   # native insets
        └── res/values/styles.xml                   # windowBackground
```

---

## 7. Open items

1. **Confirm hole editor map visible on phone** — this is the primary blocker.
   The repo code is correct. The phone has never run it. Fix the git pull first.
2. **Verify play map on real device** — GPS ball, white distance chips, rotation
   are built but never tested at a real golf course.
3. **Distance accuracy** — user reported ~33m short vs Grint. Likely the green
   pin is placed at front edge, not geometric centre. Check placement before
   changing any maths.
4. **API key unrestricted** — deliberate user decision. Key is in `.env.local`
   only, never committed. It IS embedded in the built JS/APK bundle — restrict
   by package name + SHA-1 before any public distribution.
5. **No web deployment yet** — Vercel was discussed; user wanted standalone repo.
   Create at github.com/new manually, set Root Directory to `tron-golf`, add
   `VITE_GOOGLE_MAPS_KEY` as env var.
