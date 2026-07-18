# DECISIONS

Running log of deviations from `docs/GDD.md`, and judgment calls made where a requirement was
ambiguous. One entry per decision, newest first.

## M0 — Project Bootstrap

- **Android application ID**: chose `com.wildcore.beastprotocol` (not specified in the GDD).
  This is baked into the Android project's package structure now; changing it later means
  regenerating the `android/` platform. Flag before Play Store submission if a different ID is
  wanted.

- **Integer-zoom scaling**: implemented with Phaser's built-in `Scale.FIT` + `Scale.MAX_ZOOM`,
  which pixel-perfectly integer-scales the 320x180 critical frame and centers it with letterbox
  bars on any aspect ratio. Verified at 16:9, 19.5:9, and 21:9 — crisp pixels, no stretching, no
  glitches at any tested ratio.

- **Letterbox-extended backgrounds deferred**: the GDD (§0) asks for stage backgrounds to extend
  into the letterbox space on wider-than-16:9 screens instead of showing black bars. There is no
  background art yet (M0 is colored-rectangle stubs), so there is nothing to extend. Built the
  constants for it now (`EXTENDED_WIDTH` in `src/config/resolution.ts`, sized for 21:9 at the
  native 180px height) so the plan is documented, but the actual wider background
  camera/layer will be implemented when stage art lands (M2+). Until then, wider screens
  letterbox with black bars via the native Phaser scaling above — acceptable for stubs.

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
