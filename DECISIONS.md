# DECISIONS

Running log of deviations from `docs/GDD.md`, and judgment calls made where a requirement was
ambiguous. One entry per decision, newest first.

## M0 — Project Bootstrap

- **P1 fix: letterbox-extended backgrounds, for real this time.** The original M0 PR deferred
  this (see the superseded entry below) reasoning that stub scenes had no background art to
  extend. Real-device QA on a Samsung S25 (~19.5:9) showed that reasoning doesn't hold even for
  a solid-color stub background: a fixed 320px-wide logical canvas pillarboxed on both sides
  instead of the color filling the screen. Fixed by making the logical canvas width
  device-aspect-dependent: `computeRenderWidth()` in `src/config/resolution.ts` now returns
  `clamp(deviceAspect * 180, 320, 420)` instead of a hardcoded `320`, computed at boot from
  `window.innerWidth/innerHeight` and kept in sync afterward via `src/systems/responsiveScale.ts`
  (`game.scale.setGameSize`) for foldables/split-screen/dev-window-resize. Gameplay-critical
  content still centers within the inner 320px "safe zone" (`BaseScene#safeZoneX`) so hazards and
  UI stay reachable regardless of how much extra width a given device shows — only background
  elements (the ground panel, camera background color) span the full dynamic width. Verified with
  `computeRenderWidth` unit tests (16:9, S25's 19.5:9, exact 21:9, wider-than-21:9 clamp,
  narrower-than-16:9) and a headless-browser check at the S25's exact aspect ratio showing 0px of
  pillarbox.

- **P1 fix: manual pause, and why it's a separate code path from the background auto-pause.**
  Added a corner pause button (`BaseScene`, top-right of the safe zone) so pause is directly
  testable without backgrounding the app (there is no way to observe whether an invisible,
  backgrounded app actually paused). Discovered while implementing this that a naive
  "call `game.pause()` on tap" would have been a real bug: a full engine pause halts Phaser's own
  input dispatch, so the pause button itself would become untappable and the game would be stuck
  paused with no way to resume from a tap. Manual pause is instead a scene-level flag that only
  skips `BaseScene`'s `fixedUpdate` stepping, leaving Phaser's input/render loop running so the
  button stays responsive. The app-background auto-pause path (`src/systems/lifecycle.ts`) is
  unaffected and still uses a full `game.pause()` — correct there, since nothing is visible to
  tap while backgrounded anyway. Also extracted the pause/resume decision logic into a pure,
  now-unit-tested `createPauseController` (previously this had zero test coverage), including a
  regression test for a known Android WebView quirk: `visibilitychange` doesn't always fire in
  step with the real Activity state, so a stray "visible" event must not resume the game while
  the native App plugin still reports the app backgrounded.

- ~~**Letterbox-extended backgrounds deferred**~~ — superseded above; kept for history. The GDD
  (§0) asks for stage backgrounds to extend into the letterbox space on wider-than-16:9 screens
  instead of showing black bars. Original reasoning: there was no background art yet (M0 is
  colored-rectangle stubs), so there was "nothing to extend" — wrong, a solid-color background is
  still a background, and it still needs to fill the screen.

- **Android application ID**: chose `com.wildcore.beastprotocol` (not specified in the GDD).
  This is baked into the Android project's package structure now; changing it later means
  regenerating the `android/` platform. Flag before Play Store submission if a different ID is
  wanted.

- **Integer-zoom scaling**: implemented with Phaser's built-in `Scale.FIT` + `Scale.MAX_ZOOM`,
  which pixel-perfectly integer-scales the logical canvas and centers it. The logical canvas
  width itself is device-aspect-dependent (see the background-extend fix above) rather than a
  fixed 320 — so on 16:9 it's exactly 320 with no pillarbox, and up to 21:9 it grows to match the
  device with no pillarbox either; only beyond 21:9 does the FIT/MAX_ZOOM letterbox math add real
  bars, per the GDD's supported range. Verified at 16:9, 19.5:9, and 21:9 — crisp pixels, no
  stretching, no glitches at any tested ratio.

- **Fixed 60Hz logic step**: implemented as an accumulator (`src/systems/fixedTimestep.ts`)
  driving a `fixedUpdate(dtMs)` hook on `BaseScene`, rather than relying on Phaser's variable
  per-frame `update`. This guarantees deterministic simulation independent of display refresh
  rate (important for 90Hz/120Hz Android panels) and exposes a `renderAlpha` so sprite positions
  can be interpolated between fixed steps instead of visibly stepping. `StageScene`'s placeholder
  "pacer" rectangle exercises this now so M1's Player controller has a proven pattern to build on.

- **Immersive fullscreen implementation**: Capacitor's core `StatusBar` plugin only hides the
  status bar, not the Android navigation bar. Implemented true immersive-sticky mode natively in
  `MainActivity.java` via `WindowInsetsControllerCompat` (edge-to-edge + hide both system bars,
  re-applied on window focus regain so a swipe-to-reveal doesn't stick), with the JS-side
  `StatusBar` plugin call in `src/systems/statusBar.ts` as a second pass for the WebView chrome.

- **Landscape lock**: done via `android:screenOrientation="sensorLandscape"` in
  `AndroidManifest.xml` (holds before the WebView/JS even loads) rather than a JS-only lock. Kept
  a best-effort Web Screen Orientation API call in `src/systems/orientation.ts` for the web
  preview, which silently no-ops outside a fullscreen gesture (expected browser limitation, not a
  bug).

- **Capacitor CLI dev-dependency vulnerability**: `npm audit` flags a high-severity `tar` advisory
  transitively via `@capacitor/cli@6.x`'s dependency chain. The fix requires bumping to
  `@capacitor/cli@8.x`, a breaking major version change that contradicts the GDD's explicit
  "Capacitor 6" pin. `@capacitor/cli` is a build-time-only dev dependency (not shipped in the app
  bundle), so risk is limited to the local/CI build environment. Staying on 6.x for now; revisit
  if the PO wants to move off the pinned major.

- **Vercel preview requires PO-side setup**: the `vercel-preview` CI job is gated on repo
  variables `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` and secret `VERCEL_TOKEN` being present — it
  skips cleanly (not a red CI run) until those are configured. Someone with repo admin access
  needs to link the Vercel project and add those three values under Settings → Secrets and
  variables → Actions before the first real preview link appears on a PR.

- **Bundle size**: the production JS bundle is ~1.2MB minified (~320KB gzip), almost entirely
  Phaser itself. Not a problem yet, but flagging per rule #6 (performance floor) — if load time on
  a mid-range Android WebView becomes an issue, code-splitting Phaser out of the initial chunk is
  the first lever to pull, before cutting content.
