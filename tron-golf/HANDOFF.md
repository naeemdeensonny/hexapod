# TRON Golf — Handoff Memo

**Date:** 2026-07-29 (third session update)
**Repo:** `naeemdeensonny/hexapod`, subfolder `tron-golf/`
**Branch:** `claude/tron-golf-v1-ui-xnoqs6`
**Latest commit:** `f44208f`

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

### THE FIRST THING TO DO

On the Windows machine, in CMD:

```
cd "C:\Users\Naeem Deen\tron-golf-tmp\tron-golf"
git status
git diff src/screens/HoleEditor.tsx
```

If `git status` shows `HoleEditor.tsx` as modified → local changes are blocking the pull.
Fix with:
```
git checkout -- src/screens/HoleEditor.tsx
git pull origin claude/tron-golf-v1-ui-xnoqs6
```

Then verify the file no longer contains "PIN POINTS":
```
findstr "PIN POINTS" src\screens\HoleEditor.tsx
```
Should return nothing. If it still returns a match → the pull failed again.

Then build and install:
```
npm run build
npx @capacitor/cli sync
cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
.\gradlew clean assembleDebug
```

**UNINSTALL the old app from the phone first** (long-press → Uninstall).
Then install the new APK from:
`android\app\build\outputs\apk\debug\app-debug.apk`

Open app → check footer: `V1 · OFFLINE-FIRST · BUILD 07-29 HH:MM`
If it shows today's date → build is fresh → test hole editor.

---

## 3. CSS layout fix (also in repo, commit f44208f)

Even after the correct JS arrives, the CSS must also be correct. These are the
relevant rules in `src/theme/components.css`:

```css
/* screen-body must have min-height:0 and flush must be overflow:hidden */
.screen-body {
  flex: 1;
  min-height: 0;          /* ← required for flex constraint to propagate */
  overflow-y: auto;
  ...
}
.screen-body.flush {
  padding: 0;
  gap: 0;
  overflow: hidden;       /* ← child containers own their own scrolling */
}

/* map fills remaining space — no vh units (unreliable in Android WebView) */
.hedit__map {
  flex: 1 1 0;            /* ← grows to fill, not flex:0 0 44vh */
  min-height: 200px;
  position: relative;
  border-bottom: ...;
}

/* controls claim only their natural height */
.hedit__body {
  flex: 0 0 auto;         /* ← was flex:1 1 auto (wrong — stole map space) */
  min-height: 0;
  overflow-y: auto;
  ...
}
```

The old code had `flex: 0 0 44vh` on `.hedit__map`. `vh` = large-viewport height
in Chrome/WebView (includes browser chrome area). Combined with the missing
`min-height: 0` on `.screen-body` and `overflow-y: auto` on the flush variant,
this created a circular height dependency and the map resolved to ~0px. The fix
eliminates all `vh` and `height: 100%` dependency.

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

### 4.4 Map rotation

Heading = `bearing(tee, greenCentre)`, applied in the `idle` callback after
`fitBounds` (because `fitBounds` resets heading to north):

```ts
if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
if (h !== null) google.maps.event.addListenerOnce(map, 'idle', () => map.setHeading(h));
```

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
