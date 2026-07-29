# TRON Golf — Handoff Memo

**Date:** 2026-07-29 (updated same day, second session)
**Repo:** `naeemdeensonny/hexapod`, subfolder `tron-golf/`
**Branch:** `claude/tron-golf-v1-ui-xnoqs6`
**Head at handoff:** `b2ee9d3`

---

## 1. What the project is

Mobile-first golf GPS + scorecard app with a retro TRON/neon pixel aesthetic.
Runs as a web app / PWA, and is wrapped with Capacitor into an Android APK for
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

**Working features:** course CRUD, per-hole tee/green placement on a satellite
map, auto-measured distances, scorecard, round history, settings, play map with
GPS tracking and rotation-to-hole.

---

## 2. THE UNRESOLVED BUG — read this first

### Symptom

On the **Android APK**, opening a hole in the hole editor
(`/courses/edit/:courseId/hole/:n`) shows **no map**. The map container appears
collapsed to roughly 20–30 px tall. The `PLACING: TEE` badge, which is
absolutely positioned inside the map container, visually overlaps the controls
below it.

On **desktop browser the same screen renders correctly.**

### Status: NOT root-caused. The decisive diagnostic has not been run.

Everything below is honest about what is confirmed vs. assumed.

### What is CONFIRMED

- The layout code is correct in a browser. Verified with a headless Chromium
  screenshot at 412×915 (phone viewport) against commit `df6000e`: the map
  region holds 44vh and every control fits on one screen. Screenshot was taken
  from a real `vite preview` build, not a mock.
- Desktop browser on the user's own Windows machine also rendered the map
  correctly (user-supplied screenshot), including live satellite tiles, which
  proves `VITE_GOOGLE_MAPS_KEY` is present and working in their build
  environment.
- `targetSdkVersion = 36`. Android 15+ (API 35+) **forces** edge-to-edge, and
  API 36 removed the `windowOptOutEdgeToEdgeEnforcement` opt-out. The WebView
  therefore always draws under the system bars, and Android WebView never
  populates CSS `env(safe-area-inset-*)`. This was a real, separate bug and it
  IS fixed natively (see §3).

### What is STRONGLY SUSPECTED but UNPROVEN

**The APK on the phone has never actually run the pushed code.**

Evidence for this:

1. The user repeatedly observed the built `app-debug.apk` file timestamp NOT
   advancing after a rebuild (e.g. rebuilt at 04:24, file still stamped 04:19).
2. Gradle output repeatedly showed `101 actionable tasks: 83 up-to-date`.
3. `.\gradlew clean assembleDebug` from the command line **cannot run on this
   machine** — system Java is 1.8.0_421, and AGP 8.13 requires JVM 11+. So the
   only build path is Android Studio's bundled JDK via the GUI, which is exactly
   the path that kept serving cached output.
4. A user screenshot taken at 13:48 still showed the `PIN POINTS` panel title
   and the helper sentence "Select which pin map taps move, then tap the
   satellite image." **Both of those strings were deleted** in commit `df6000e`.
   Their presence is proof that build was stale. (That screenshot predates
   `df6000e`, so it is consistent — but the same check is now the fastest way to
   test any future build.)
5. A genuine second cause was found and fixed (service worker, §3.4) which would
   have pinned the native app to its first-ever cached build regardless of how
   many correct APKs were installed on top.

### THE FIRST THING THE NEXT PERSON SHOULD DO

Do not touch layout code until you have answered this. Install the current
build, open the app, and check **two things**:

1. **Home screen footer.** It must read `V1 · OFFLINE-FIRST · BUILD MM-DD HH:MM`
   with a UTC timestamp matching when you ran `npm run build`. This stamp was
   added in `b2ee9d3` specifically to end the "is this build fresh?" ambiguity.
   - Footer shows an old timestamp, or shows `SATELLITE MAP` instead of
     `BUILD …` → **the APK is stale. The bug is in the build pipeline, not the
     CSS.** Go to §4.
2. **Hole editor screen.** Does it show a `PIN POINTS` heading and the sentence
   "Select which pin map taps move…"?
   - Yes → stale build, same conclusion.
   - No (you see the compact two-input layout) → the build IS fresh, and you
     have a genuine Android WebView layout bug. Go to §2.1.

### 2.1 If the build IS confirmed fresh and the map is still collapsed

Then it is a real WebView-specific layout failure. Ranked hypotheses:

1. **`vh` units inside the Capacitor WebView.** `.hedit__map` uses
   `flex: 0 0 44vh`. If the WebView resolves `vh` against a zero or
   not-yet-measured viewport at first paint, the basis collapses. `min-height:
   180px` should backstop this, so if the map is under 180 px tall, `vh`
   resolution is not the whole story — but swap `44vh` for a pixel value or
   `flex: 1 1 0` with an explicit `min-height` and retest. This is the cheapest
   experiment.
2. **Height chain broken.** `html, body, #root { height: 100% }` →
   `.app { height: 100% }` → `.hedit { height: 100% }`. If any ancestor
   resolves to `auto`/0 in the WebView, percentage heights collapse. Replace
   `height: 100%` with `height: 100dvh` on `.app`, or use
   `position: fixed; inset: 0` on the shell, and retest.
3. **The native inset padding.** `MainActivity.java` pads
   `android.R.id.content` and returns `WindowInsetsCompat.CONSUMED`. If that
   padding is applied after the WebView has measured, the WebView may hold a
   stale viewport height. Test by temporarily commenting the inset listener out
   and seeing whether the map returns.
4. **Google Maps failing to init in the WebView**, leaving a zero-height child.
   Less likely — the container itself is collapsed, and the play map's Google
   Map does render on the phone. But confirm by remote-debugging (§5) and
   inspecting the actual computed height of `.hedit__map`.

---

## 3. Fixes already made (all pushed, all on `claude/tron-golf-v1-ui-xnoqs6`)

### 3.1 System bars overlapping the app — FIXED, confirmed working

`targetSdk 36` forces edge-to-edge and Android WebView does not fill in
`env(safe-area-inset-*)`, so CSS-only approaches did nothing. Two earlier
attempts (pure CSS `env()`, then a JS injection of hardcoded px values) both
failed for this reason and were reverted.

Working fix — `android/app/src/main/java/com/tronn/golf/MainActivity.java`
applies the real insets natively:

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

Plus `android:windowBackground` set to `#050A12` in `styles.xml` so the strips
behind the bars are dark, not white. **User confirmed the nav bar is no longer
blocked.**

### 3.2 Hole editor layout rewrite (`df6000e`)

The map container used to be a plain `height: 240` div inside `.screen-body`,
which is `display: flex; flex-direction: column`. Default `flex-shrink: 1` let
the flex column crush it to nothing once the panels below overflowed.

First fix was `flex: 0 0 240px`. That works in a browser but left the map inside
a shared flex context. Second fix removed the dependency entirely: `HoleEditor`
now renders with `Screen flush` and owns its own column —
`.hedit` / `.hedit__map` (`flex: 0 0 44vh`, `min-height: 180px`) /
`.hedit__body` (`flex: 1 1 auto; min-height: 0; overflow-y: auto`).

Also stripped for compactness: both `Panel` wrappers, the helper sentence, and
the redundant lat/lng echo under each coordinate row.

### 3.3 Global compaction (`df6000e`)

Applied via design tokens in `src/theme/tokens.css` so every screen shrinks
consistently: type scale down one step (title 13→11, btn 11→10, label 9→8,
micro 8→7, body 14→13), spacing scale 4/8/12/16/24 → 3/6/9/12/18, header
52→44px, nav 56→46px, tap target 44→40px.

> Note: 40px tap targets are just under the 44px accessibility guideline. This
> was a deliberate trade for density; revisit if anything feels fiddly.

### 3.4 Service worker poisoning the native app (`b2ee9d3`) — IMPORTANT

`vite-plugin-pwa` was auto-injecting `registerSW.js` into `index.html`. Inside
the Capacitor WebView, Workbox precached the entire app into WebView storage —
**and Android does not clear app data when you install a new APK over an old
one.** So the native app could serve its first-ever cached build forever,
regardless of how many correct APKs were installed on top.

Fix: `injectRegister: null` in `vite.config.ts`; registration moved into
`src/main.tsx`, guarded so it only runs on the web. On native the app instead
unregisters all service workers and deletes all caches at startup.

**Chicken-and-egg caveat:** that cleanup code can only run if it is reached, and
a poisoned cache prevents that. **The phone must be fully uninstalled once**
(long-press → Uninstall) to break out. Installing over the top is not enough.
The user was told this; whether it was actually done before the last test is
**unconfirmed** and is a live possibility for why the symptom persisted.

### 3.5 Play map GPS + on-map labels (`747299c`)

- GPS marker is an 8-bit pixel-art golf ball (`GOLF_BALL_SVG` in
  `src/map/GoogleMap.tsx`, drawn with `shape-rendering="crispEdges"`).
- Distances moved off the UI panels and onto the map itself. Segments run
  tee → you → target → green; each is a white polyline with a white-on-dark
  chip at its midpoint (`distanceLabelIcon()`). A segment is dropped when its
  ends are within 3 m, so by default you get exactly two: **tee → you** and
  **you → green**. Labels are marker icons, so they stay screen-upright while
  the map is rotated.
- Bottom panel stripped to just RE-CENTRE and SCORE.
- `RE-CENTRE` now re-applies the heading, since `fitBounds` snaps back to north.

**This is built and pushed but has NOT been visually confirmed on the phone**,
because of the stale-build problem.

### 3.6 Map rotation (earlier, working)

`fitBounds` is async and resets heading to north. Heading must be applied in the
`idle` callback that follows it:

```ts
if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
if (h !== null) google.maps.event.addListenerOnce(map, 'idle', () => map.setHeading(h));
```

Behaviour: fixed north-up-the-hole orientation, recomputed as
`bearing(tee, greenCentre)` whenever the hole changes. Confirmed as the desired
behaviour by the user.

---

## 4. Build & deploy — including the traps

### Web build

```bash
cd tron-golf
npm install
npm run build          # tsc -b && vite build
```

### Android APK (user is on Windows)

```
cd C:\Users\Naeem Deen\tron-golf-tmp\tron-golf
git pull origin claude/tron-golf-v1-ui-xnoqs6
npm run build
npx @capacitor/cli sync
```

**Preferred: command-line build (now working, bypasses Gradle cache):**

```
cd C:\Users\Naeem Deen\tron-golf-tmp\tron-golf\android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
.\gradlew clean assembleDebug
```

Output: `app\build\outputs\apk\debug\app-debug.apk`. Build time ~24s.

**Fallback: Android Studio GUI** → Close Android Studio first (Gradle daemon conflict) → Build → Clean Project → Build APK(s). GUI also works but was previously serving cached output — always do `Clean Project` first.

### Environment traps hit during this session — all real, all will recur

| Trap | Detail |
|---|---|
| `npx cap sync` fails | `could not determine executable to run`. Use `npx @capacitor/cli sync` (the full package name). `npx cap` does not resolve on this machine. |
| Must be run from `tron-golf/` | Running from `tron-golf/android/` gives "needs to run at the root of an npm package". |
| `capacitor.config.ts` not read on Windows | Capacitor looked for `./www` instead of `dist`. Fixed by adding a plain **`capacitor.config.json`** next to the `.ts` one. Both exist now; the JSON is the one being honoured. |
| `.env.local` is gitignored | Never arrives via `git pull`. Must exist locally with `VITE_GOOGLE_MAPS_KEY=…` or the map renders a "Map key not set" placeholder. |
| **System Java is 1.8 — NOW FIXED** | Was `1.8.0_421`. Oracle Java 8 was in System PATH (`C:\Program Files (x86)\Common Files\Oracle\Java\java8path`) and overrode JDK 17. Removed that entry. **JDK 21 required** — Capacitor 8 sets `sourceCompatibility = JavaVersion.VERSION_21`, so JDK 17 fails with `invalid source release: 21`. JDK 21.0.11.10 (Adoptium Temurin) is now installed at `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`. User `JAVA_HOME` set to that path. Command-line Gradle builds now work. |
| Play Protect blocks install | Tap the **"Install anyway"** *text link*, not the blue OK button (OK cancels). |
| Installing over the old app | Does **not** clear WebView storage. Uninstall fully when testing a web-asset change. |

---

## 5. Recommended next step: stop guessing, remote-debug the WebView

This was never done and would have settled the question hours ago.

1. Enable USB debugging on the phone, connect it to the Windows machine.
2. Open desktop Chrome → `chrome://inspect/#devices`.
3. The Capacitor WebView appears in the list → click **inspect**.
4. You now have full DevTools against the app running on the phone.

Then, concretely:

- **Console:** `document.querySelector('.hedit__map').getBoundingClientRect()`
  — read the real height. This single number decides everything.
- **Console:** check whether `.hedit__map` even exists. If the DOM still has the
  old `PIN POINTS` panel, the build is stale and the CSS is irrelevant.
- **Application → Service Workers:** confirm none are registered.
- **Application → Cache Storage:** confirm it is empty.
- **Elements:** inspect the computed height chain from `html` down to
  `.hedit__map` to find exactly where the height collapses.

---

## 6. File map

```
tron-golf/
├── capacitor.config.json          # the one Capacitor actually reads on Windows
├── capacitor.config.ts            # TS twin; not honoured on the Windows setup
├── vite.config.ts                 # PWA config, injectRegister:null, __BUILD_ID__ define
├── index.html
├── .env.local                     # GITIGNORED — VITE_GOOGLE_MAPS_KEY lives here
├── src/
│   ├── main.tsx                   # SW register (web only) / SW+cache purge (native)
│   ├── App.tsx                    # routes
│   ├── theme/
│   │   ├── tokens.css             # ALL sizing/spacing/type tokens — compaction lives here
│   │   └── components.css         # .hedit* layout, .coord*, nav, header, panels
│   ├── components/Screen.tsx      # app shell: header + body + bottom nav; `flush` prop
│   ├── map/
│   │   ├── GoogleMap.tsx          # loader, markerIcon(), GOLF_BALL_SVG,
│   │   │                          #   distanceLabelIcon(), midpoint(), paddedBounds()
│   │   └── map.css
│   ├── state/
│   │   ├── store.ts               # useSyncExternalStore + localStorage
│   │   ├── types.ts               # Course, Hole, Round, LatLng
│   │   └── geo.ts                 # distanceM (Haversine), bearing, destination, fmtDist
│   └── screens/
│       ├── Menu.tsx               # home; footer carries the BUILD stamp
│       ├── Courses.tsx / AddCourse.tsx / EditCourse.tsx
│       ├── HoleEditor.tsx         # ← THE BROKEN SCREEN
│       ├── PlayMap.tsx            # GPS, on-map distance labels, rotation
│       ├── HoleSelect.tsx / ScoreEntry.tsx / Scorecard.tsx
│       ├── RoundSetup.tsx / RoundComplete.tsx / History.tsx / Settings.tsx
└── android/                       # Capacitor project (build artefacts gitignored)
    └── app/src/main/
        ├── java/com/tronn/golf/MainActivity.java   # native window insets
        ├── res/values/styles.xml                   # windowBackground #050A12
        └── AndroidManifest.xml
```

---

## 7. Open items beyond the map bug

1. **Verify the play map on a real phone at a course.** GPS ball, the two white
   distance chips, and hole-change rotation are all built but unconfirmed on
   device.
2. **Distance accuracy.** The user reported readings ~33 m short vs. the Grint
   app. The Haversine implementation in `geo.ts` is mathematically correct, so
   the most likely cause is the green-centre pin being placed at the front edge
   rather than the geometric centre of the green. Worth verifying against a
   known hole before changing any maths.
3. **No deployment yet.** Vercel was discussed; the user declined deploying from
   the `hexapod` repo and wanted a standalone `tron-golf` repo. Repo creation
   failed — the GitHub integration lacks repo-creation permission — so it must
   be created manually at github.com/new, then Root Directory set to `tron-golf`
   and `VITE_GOOGLE_MAPS_KEY` added as an env var.
4. **API key is unrestricted.** Deliberate user decision ("no need to restrict it
   for now"; will rotate before commercialising). It lives only in `.env.local`
   and has never been committed. **Note that it IS embedded in the built JS
   bundle and therefore in the APK** — unavoidable for a client-side Maps key,
   but worth restricting by package name + SHA-1 before any public distribution.

---

## 8. Blunt summary for whoever picks this up

The user was understandably frustrated: many APKs installed, app barely changed.
Root cause: Android Studio's Gradle cache produced stale APKs, AND a Workbox
service worker pinned the WebView to its first-ever cached build across
reinstalls. Both have been fixed.

**As of the end of session 2**, command-line Gradle builds now work (`BUILD
SUCCESSFUL in 24s`, 97 tasks executed). A fresh APK was just produced. The user
is about to install it.

**Critical install procedure:**
1. **UNINSTALL** the old app first (long-press → Uninstall). Do NOT install over.
2. Install the new `app-debug.apk`.
3. Open app → check footer: `V1 · OFFLINE-FIRST · BUILD 07-29 HH:MM`.
4. If footer is fresh, test the hole editor map.

**Read that stamp before writing a single line of CSS.** If the build IS fresh
and the map is still collapsed, you have a genuine WebView layout bug — follow
§2.1 and remote-debug per §5 rather than guessing.
