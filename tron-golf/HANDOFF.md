# TRON Golf — Full Handoff (for Codex / any new agent)

**Written:** 2026-07-29, end of a long multi-session build.
**Repo:** `github.com/naeemdeensonny/hexapod`
**App lives in subfolder:** `tron-golf/`
**Active branch:** `claude/tron-golf-v1-ui-xnoqs6`
**HEAD at handoff:** `b7786ea`
**Owner:** Naeem (solo, non-coder — needs exact copy-paste commands, not concepts).

Read sections 2 and 3 before touching anything. Most of the pain in this
project was environment/sync, not application logic.

---

## 1. What the app is

Mobile-first golf GPS + scorecard, retro TRON/neon pixel aesthetic. Runs as a
web app / PWA and is wrapped with Capacitor into an Android APK for personal
sideloading (no Play Store). Fully offline; all data in `localStorage`.

### Stack

| Layer | Choice |
|---|---|
| Build | Vite 5, TypeScript 5, React 18 |
| Routing | React Router v6, **HashRouter** (`/#/...` URLs) |
| State | `useSyncExternalStore` + `localStorage` write-through, key `tron-golf:v1` |
| Maps | `@googlemaps/js-api-loader` v2, Google Maps JS API, satellite tiles |
| PWA | `vite-plugin-pwa` (Workbox) |
| Native | Capacitor **8** (`@capacitor/core|cli|android` ^8.4.2), appId `com.tronn.golf` |

### Features that work

Course CRUD; per-hole tee/green placement on a satellite map with
auto-measured distance; scorecard; round history; settings; play map with GPS
tracking, tilt + rotation, and on-map distance labels; **backup/restore**
(export & import all data).

---

## 2. THE REPO / PC FOLDER ISSUE — this wasted the most time, understand it fully

There are **two different codebases** that look similar and got confused for
each other repeatedly. Every "I installed it but nothing changed" was really
"the build came from the wrong folder."

### 2a. The correct code — GitHub

- Repo: `naeemdeensonny/hexapod`
- The app is in the **`tron-golf/` subfolder** of that repo.
- Work happens on branch **`claude/tron-golf-v1-ui-xnoqs6`**.
- `main` exists but the app work is on the `claude/...` branch. Do NOT assume
  `main` is current.

So in a fresh clone the app is at `hexapod/tron-golf/`, and `package.json`,
`src/`, `android/` all live **under that subfolder**.

### 2b. The stale copy on the PC — abandon it

The user's machine had a folder:

```
C:\Users\Naeem Deen\tron-golf-tmp\tron-golf
```

This turned out to be a **completely separate git repo** — NOT a clone of
hexapod. Proof observed during the session:

- Its `git status` showed branch `master` tracking `origin/master`
  (hexapod has no `master`; it has `main` + the `claude/...` branch).
- Its files were at the **repo root** (`package.json`, `.env.example` directly
  there), whereas in hexapod they are one level down under `tron-golf/`.
- Its latest commit was `bed226d "Simplify hole editor..."`, which is not in
  hexapod's history at all.

Because `origin` pointed somewhere else, every `git pull` in that folder either
failed (`couldn't find remote ref claude/...`) or pulled unrelated `master`
history — so the pushed fixes never arrived, and every APK built from it was
stale. This is why the phone kept showing old UI (`PIN POINTS`, `UPDATE FENCE`,
the old badge text) no matter how many times it was rebuilt.

### 2c. The fix that was put in place — a fresh clone

The user was told to clone hexapod fresh into a NEW folder and only ever use
that one:

```
cd C:\Users\Naeem Deen
git clone https://github.com/naeemdeensonny/hexapod.git tron-golf-v2
cd tron-golf-v2
git checkout claude/tron-golf-v1-ui-xnoqs6
cd tron-golf
```

**From now on the only working directory is:**

```
C:\Users\Naeem Deen\tron-golf-v2\tron-golf
```

The old `tron-golf-tmp` is dead — do not build from it, do not pull into it.

### 2d. Golden rule for updating the PC: use reset --hard, not pull

`git pull` repeatedly no-op'd or failed here (local edits, wrong remote). The
reliable update sequence, which cannot silently do nothing:

```
cd C:\Users\Naeem Deen\tron-golf-v2\tron-golf
git fetch origin claude/tron-golf-v1-ui-xnoqs6
git reset --hard origin/claude/tron-golf-v1-ui-xnoqs6
```

Gitignored files (`.env.local`, `android/local.properties`) survive this.

### 2e. ALWAYS verify freshness before building

Two independent freshness checks — run at least one every single time:

1. Source string check (must print nothing):
   ```
   findstr /C:"PIN POINTS" src\screens\HoleEditor.tsx
   ```
   The string `PIN POINTS` was deleted long ago; if it appears, the working
   copy is stale — stop, fix the checkout, do not build.

2. Build stamp in-app: Home/Menu footer reads
   `V1 · OFFLINE-FIRST · BUILD MM-DD HH:MM` (UTC, injected by Vite via
   `__BUILD_ID__`, see `vite.config.ts`). After installing, confirm it shows
   the time you just built.

---

## 3. Build & install — the whole pipeline, with the traps

### 3a. Web build (also the fastest way to test everything but GPS)

```
cd C:\Users\Naeem Deen\tron-golf-v2\tron-golf
npm install
npm run build      # tsc -b && vite build
npm run preview    # serves dist/ at a localhost URL for browser testing
```

### 3b. Android APK

```
cd C:\Users\Naeem Deen\tron-golf-v2\tron-golf
npm run build
npx @capacitor/cli sync
cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
.\gradlew clean assembleDebug
```

APK output: `android\app\build\outputs\apk\debug\app-debug.apk`
(~24s, ~97 Gradle tasks, ends `BUILD SUCCESSFUL`).

Install: **UNINSTALL the old app is NOT required anymore** (see 3d) — prefer
install-over to preserve data. Play Protect will warn: tap the **"Install
anyway" text link**, not the blue OK button (OK cancels).

### 3c. Environment setup already done on the PC (don't redo, just know it)

- **JDK 21** (Adoptium Temurin `21.0.11.10`) installed at
  `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`.
  Capacitor 8 needs Java **21** (`sourceCompatibility = VERSION_21`); JDK 17
  fails with `invalid source release: 21`; the machine's old system Java was
  1.8.
- User `JAVA_HOME` set to that JDK 21 path. Oracle `java8path` was removed from
  the System `Path`. Each new CMD window should still `set JAVA_HOME=...` +
  `set PATH=%JAVA_HOME%\bin;%PATH%` before `gradlew`, to be safe.
- `sdk.dir` / `android/local.properties` points at the Android SDK
  (`C:\Users\Naeem Deen\AppData\Local\Android\Sdk`). Gitignored.

### 3d. Traps that WILL recur (all hit during this project)

| Trap | Detail / fix |
|---|---|
| Wrong folder | See §2. Only build from `tron-golf-v2\tron-golf`. |
| `git pull` no-ops | Use `git fetch` + `git reset --hard origin/<branch>` (§2d). |
| `npx cap sync` fails | `could not determine executable to run`. Use the full name: `npx @capacitor/cli sync`. Run it from `tron-golf/`, never from `tron-golf/android/`. |
| `capacitor.config.ts` ignored on Windows | Capacitor looked for `./www` instead of `dist`. A plain **`capacitor.config.json`** (now committed) is what it actually reads. Both files exist; keep them in sync. |
| System Java 1.8 | Fixed — JDK 21 (§3c). `gradlew` needs JVM 21. |
| Android Studio GUI builds stale APKs | Its Gradle cache served old output. Prefer the command-line `gradlew clean assembleDebug`. If using the GUI: Build → Clean Project first, and close it before running CLI Gradle (daemon conflict). |
| Service worker poisoned the WebView | `vite-plugin-pwa` used to precache the whole app into WebView storage, which survives install-over — pinning the app to its first cached build forever. Fixed: `injectRegister: null` in `vite.config.ts`; registration is manual in `src/main.tsx` and only on web; on native it unregisters SWs and deletes caches at startup. Because of this fix, install-over is now safe and does NOT need a full uninstall. |
| `.env.local` gitignored | Never arrives via clone/pull. Must be created by hand (§4). Without it the map shows a "Map key not set" placeholder. |

---

## 4. Secrets / .env.local (create by hand on the PC)

`.env.local` is gitignored and must exist at `tron-golf-v2\tron-golf\.env.local`:

```
VITE_GOOGLE_MAPS_KEY=AIzaSyCIrOP4dgGHdOpNW_JIGkpdvkxoA80q1NA
VITE_GOOGLE_MAPS_ID=<vector map id — see §5.2>
```

- The key is intentionally **unrestricted** for now (owner's decision; will
  rotate + restrict by package name + SHA-1 before any public/commercial
  release). It IS embedded in the built JS bundle and the APK — unavoidable for
  a client-side Maps key, but do not commit it or paste it into GitHub.
- `.env.example` (committed) documents both variables.

---

## 5. Map behaviour — the two non-obvious gotchas

### 5.1 Hole-editor map used to collapse to ~0px on Android

Root cause was height that depended on things Android WebView doesn't resolve
reliably: `flex: 0 0 44vh` (`vh` is the *large*-viewport unit in Chrome/WebView)
and `.hedit { height: 100% }` (needs an unbroken percentage-height chain).
Both were removed.

Final approach (in `src/theme/tokens.css` and `components.css`):
- `--map-h` is an absolute px value: 260 / 320 / 380 / 440, stepped by
  `@media (min-height: …)` queries (which read the real viewport and need no
  percentage chain).
- `.hedit__map { flex: 0 0 auto; height: var(--map-h); min-height: var(--map-h) }`
  — flex negotiation cannot shrink it.
- `.hedit__body { flex: 1 1 auto; min-height: 0; overflow-y: auto }` scrolls.
- `.hedit` / `.play` are flex items of `.screen-body`, never `height: 100%`.

Verified in headless Chromium at 412×915 / 412×968 / 360×640 / 412×560 — map
measured 380 / 440 / 260 / 260 px, no nav overlap, SAVE HOLE reachable.

### 5.2 Map rotation/tilt needs a VECTOR Map ID — code alone can't enable it

`map.setHeading()` / `setTilt()` are **silent no-ops on a raster map**. The
Maps JS API builds a raster map unless you pass a **Map ID for a vector map**.
This is why rotation "never worked" for ages — not a code bug.

Required manual step (owner has been asked to do this):
Google Cloud Console → Google Maps Platform → **Map Management** → Create Map ID:
- Map type **JavaScript**, Rendering **Vector**, tick **Tilt** AND **Rotation**.
Put the resulting ID in `.env.local` as `VITE_GOOGLE_MAPS_ID`. Free.

Code side (done):
- `src/map/provider.ts` reads `VITE_GOOGLE_MAPS_ID`, exports
  `MAP_ROTATION_AVAILABLE`.
- `src/map/GoogleMap.tsx` passes `mapId` to the `Map` constructor when set, and
  exposes `faceHeading(map, heading, tilt=0)` which applies heading+tilt
  immediately AND again on the next `idle` (because `fitBounds` is async, resets
  both to zero, yet fires no `idle` when it changes nothing).
- Play map tilts to `PLAY_TILT = 60`° (Grint-style down-the-fairway); hole
  editor stays flat (tilt 0) for precise pin placement.
- Degrades cleanly: no Map ID → app runs north-up, flat, no errors.

---

## 6. GPS gating (recent, `ebe4879`)

Off the course the raw GPS fix drew a nonsensical tee→you→green dog-leg. Now a
fix is only trusted within `ON_COURSE_M = 800` m of the current hole's tee or
green (`src/screens/PlayMap.tsx`). Off course: player (golf-ball) marker hidden,
tee→you line dropped (map shows just tee→green), fence stays on the hole, and an
amber "NOT AT THE COURSE" note shows (only once there's an actual fix). On
arrival, tracking resumes automatically. `ON_COURSE_M` is a one-line tunable.

---

## 7. Backup / restore (recent, `b7786ea`)

Because storage is local-only, Settings now has a **BACKUP** panel:
- `exportBackup()` / `importBackup()` in `src/state/store.ts`. Export wraps the
  whole `AppState` in a versioned envelope (`{ app, version, exportedAt,
  state }`). Import validates before overwriting; accepts the envelope or a bare
  `AppState`.
- UI (`src/screens/Settings.tsx` → `BackupPanel`): **SAVE FILE**
  (`tron-golf-backup-YYYY-MM-DD.json`), **COPY TEXT** (clipboard, with a
  `window.prompt` fallback), **RESTORE FROM FILE** (file picker, confirms, then
  reports counts).

This is deliberately the on-ramp for the cloud work (§9): same data shape.

---

## 8. Known cosmetic issue (not blocking)

The "you" GPS marker is coded as an 8-bit golf ball (`GOLF_BALL_SVG` in
`GoogleMap.tsx`, `markerIcon('player')`), but on the tilted **vector** map it
appears as a plain red dot on the device — most likely the custom
data-URI SVG icon not rendering on a vector map, so Google shows a default
marker. Classic `google.maps.Marker` is deprecated on vector maps in favour of
`google.maps.marker.AdvancedMarkerElement`. Fix path: import the `marker`
library and render players/pins as `AdvancedMarkerElement` (which takes real DOM
/ `PinElement` content) instead of `Marker` + icon. Purely cosmetic; distances
and positions are correct.

---

## 9. NEXT BIG TASK — cloud sync (Option B), planned for the next session

Goal the owner agreed to: sign in with Google on both web and Android; courses
and rounds sync automatically between devices; local-first so nothing is lost.

### 9.1 Hard requirement: DO NOT WIPE LOCAL DATA

The owner will have set up a full course locally before this runs. Three
safeguards were promised and MUST be honoured:

1. **Backup first** — the export feature (§7) already exists; have the owner
   SAVE FILE before migrating.
2. **Local-first first sync** — on first sign-in, if the cloud doc is empty,
   **upload the existing local `AppState` to the cloud**. NEVER pull an empty
   cloud over populated local storage.
3. **Install-over, not uninstall** — the cloud build ships as an update; local
   storage survives (§3d). Do not instruct a full uninstall.

### 9.2 Recommended implementation

- **Firebase** (free Spark tier is far beyond a personal app's needs). Firestore
  + Firebase Auth (Google provider). Pairs with the owner's existing Google
  account.
- Web: `firebase` JS SDK, `signInWithPopup(GoogleAuthProvider)`.
- **Android/Capacitor is the tricky part**: `signInWithPopup` is unreliable in
  the WebView. Use a Capacitor-friendly Google sign-in
  (e.g. `@capacitor-firebase/authentication`, or
  `@codetrix-studio/capacitor-google-auth`) and hand the credential to Firebase
  Auth. Budget most of the time here.
- Data model: one Firestore document per user (`users/{uid}`) holding the same
  `AppState` shape the store already uses — so it maps 1:1 onto
  `export/importBackup`. Keep the existing `localStorage` write-through as the
  offline cache; sync the doc on auth changes and on `commit()`.
- Security rule: a user can read/write only their own `users/{uid}`.
- Conflict policy for v1: last-write-wins per document is acceptable for a
  single-user-two-devices scenario; note it and move on. Don't over-engineer.

### 9.3 Also on the list once cloud exists

- **Web deployment (Vercel).** Was declined earlier as a `hexapod`-subfolder
  deploy; owner wanted a standalone repo. Options: (a) Vercel project on
  `hexapod` with Root Directory set to `tron-golf/`, or (b) a dedicated repo.
  Add `VITE_GOOGLE_MAPS_KEY` and `VITE_GOOGLE_MAPS_ID` as Vercel env vars. A
  logged-in cloud app is what makes web deployment actually useful.

---

## 10. File map

```
hexapod/
└── tron-golf/                      # ← the app (subfolder!)
    ├── capacitor.config.json       # the config Capacitor reads on Windows
    ├── capacitor.config.ts         # TS twin; keep in sync
    ├── vite.config.ts              # PWA, injectRegister:null, __BUILD_ID__ define
    ├── .env.local                  # GITIGNORED — VITE_GOOGLE_MAPS_KEY + _ID
    ├── .env.example                # documents both env vars
    ├── HANDOFF.md                  # this file
    ├── src/
    │   ├── main.tsx                # SW register (web only) / SW+cache purge (native)
    │   ├── App.tsx                 # routes (HashRouter)
    │   ├── theme/
    │   │   ├── tokens.css          # ALL sizing/spacing/type; --map-h + media steps
    │   │   └── components.css      # .hedit*, .play*, .coord*, nav, header, panels
    │   ├── components/
    │   │   ├── Screen.tsx          # shell: header + body + bottom nav; `flush` prop
    │   │   └── ui.tsx              # Button, Panel, Segmented, Toggle, Field, etc.
    │   ├── map/
    │   │   ├── provider.ts         # GOOGLE_MAPS_KEY, GOOGLE_MAPS_ID, preview tiles
    │   │   ├── GoogleMap.tsx       # loader, Map init (mapId), faceHeading(),
    │   │   │                       #   markerIcon(), GOLF_BALL_SVG, distanceLabelIcon()
    │   │   └── map.css
    │   ├── state/
    │   │   ├── store.ts            # useSyncExternalStore + localStorage;
    │   │   │                       #   export/importBackup(); all mutations
    │   │   ├── types.ts            # Course, Hole, Round, Settings, LatLng, AppState
    │   │   ├── seed.ts             # seed courses + TEE_OPTIONS
    │   │   └── geo.ts              # distanceM (Haversine), bearing, destination, fmtDist
    │   └── screens/
    │       ├── Menu.tsx            # home; footer carries the BUILD stamp
    │       ├── Courses.tsx / AddCourse.tsx / EditCourse.tsx
    │       ├── HoleEditor.tsx      # tee/green placement; flat map
    │       ├── PlayMap.tsx         # GPS, tilt+rotation, on-map labels, ON_COURSE_M
    │       ├── HoleSelect.tsx / ScoreEntry.tsx / Scorecard.tsx
    │       ├── RoundSetup.tsx / RoundComplete.tsx / History.tsx
    │       └── Settings.tsx        # includes BackupPanel
    └── android/                    # Capacitor project (build outputs gitignored)
        └── app/src/main/
            ├── java/com/tronn/golf/MainActivity.java   # native window insets fix
            ├── res/values/styles.xml                   # windowBackground #050A12
            └── AndroidManifest.xml
```

Native detail already fixed: Android 15+/`targetSdk 36` forces edge-to-edge and
the WebView never fills CSS `env(safe-area-inset-*)`, so system bars overlapped
the UI. Fixed natively in `MainActivity.java` via
`ViewCompat.setOnApplyWindowInsetsListener` padding
`android.R.id.content` by `systemBars | displayCutout`. Confirmed working.

---

## 11. Immediate checklist for tomorrow (owner will be playing)

1. `reset --hard` + build + install the latest APK from `tron-golf-v2`.
2. Confirm freshness (§2e): footer build stamp, and `findstr "PIN POINTS"`
   prints nothing.
3. Set up the course to be played **in the Android app** (local storage is not
   shared with the browser).
4. Settings → **BACKUP → SAVE FILE** after setup (protects it before the cloud
   migration).
5. Place each green pin at the **centre of the green** — distance accuracy
   depends on it (owner saw ~33 m short vs Grint; almost certainly pin
   placement, not the Haversine maths in `geo.ts`).

---

## 12. Blunt summary for whoever picks this up

The application code is in good shape and verified. The recurring failure mode
in this project has been **environment and sync**, not logic: the wrong PC
folder (a separate repo), `git pull` silently no-op'ing, Android Studio's Gradle
cache, and a Workbox service worker pinning the WebView to an old build. All are
now addressed, and there are two freshness checks (build stamp + `PIN POINTS`
string) — use them before writing any code or blaming the app.

Two things genuinely need a human, not code: creating the **vector Map ID** in
Cloud Console (enables rotation/tilt), and, next, the **Firebase project + Google
sign-in** for cloud sync. When you build cloud sync, the single most important
rule is **local-first: never let an empty cloud overwrite the owner's
locally-created course.**
