# DECISIONS

Running log of deviations from `docs/GDD.md`, and judgment calls made where a requirement was
ambiguous. One entry per decision, newest first.

## M2 — Speedway Savanna Stage

- **P0-class bug found and fixed: ground collision silently did nothing.** `groundLayer.setCollisionByExclusion([0])` excludes tile *index* 0 from collision - but Phaser's Tiled-JSON parser represents an empty (Tiled GID 0) cell internally as tile index **-1**, not 0. Excluding `[0]` therefore excluded nothing that actually existed in the layer, and (worse) left every empty cell marked collidable too, alongside the real ground tiles. With the whole grid uniformly "solid," `CalculateFacesWithin` found zero tiles with an "interesting" (boundary) face anywhere - Arcade's tile-collision routine skips tiles without one as an optimization - so the player fell straight through the entire map on every frame, repeatedly triggering the pit-fall respawn. Caught via a headless Playwright session that exposed a temporary `window.__debugGame` hook and polled `player.body.blocked.down` frame-by-frame after scene load: it never once went true. Root-caused by walking Phaser's own `GetTileAt`/`CalculateFacesWithin` source and confirming live (`layer.data[9][1].index === -1`) that empty cells are index -1, not 0. Fixed by excluding `[-1]` instead. Would not have reproduced against M1's `GymScene`, which builds its ground from `physics.add.staticImage` blocks, not a Tiled tile layer - the first tilemap-backed stage was needed to expose it.

- **Second bug from the same investigation: no enemy ever collided with the ground layer.** `BaseStageScene` only ever added `physics.add.collider(this.player, this.groundLayer)` - gravity-bearing enemies (Spark Bug, Volt Cheetah) had no ground collider of their own and fell forever the instant they spawned, never landing, never able to trigger their `body.blocked.down`-gated behavior (Spark Bug's hop timer only counts down while grounded). Flying/rooted enemies (Patrol Drone, Turret Sunflower) disable their own gravity and were unaffected. Fixed with one additional `physics.add.collider(this.enemies, this.groundLayer)` after entity setup - a no-op for the gravity-less enemies, load-bearing for the other two.

- **Player HP was never restored on respawn - a latent M1 bug this milestone's hazards finally exercise.** `Player.respawnAt()` reset position/invuln/hitstun but left `hp` untouched, so a player who died via damage (rather than a pit-fall reset, which happens to hand back full context anyway in Gym) would respawn already dead, instantly re-triggering respawn in a loop. GymScene never surfaced this because nothing in it could actually reduce the player to 0 HP through normal play. Speedway's lethal spikes and enemy contact can, so this had to be fixed here: `respawnAt()` now resets `hp` to the max (Mega-Man convention: a death/pit-fall respawn is a full reset, not merely a teleport).

- **Electric fence damage was overlap-per-frame with dead code guarding it.** The original wiring registered one shared overlap across all fences and gated the damage amount on `fence.hazardZone.body ? damage : 0` - a body-existence check that is always true and says nothing about whether the *specific* fence the player is touching is actually active. Rewired to one `physics.add.overlap` per fence (mirroring the per-bridge collider pattern already used), passing the specific fence into the handler so `fence.isActive` gates correctly. Repeated overlap firing every physics frame while in contact is not a double-damage bug in practice - `Player.takeDamage`'s own invulnerability window (60f) already no-ops re-entrant hits - but the old code would have applied the *wrong* fence's active-state to whichever fence happened to be evaluated, in a multi-fence scene.

- **Checkpoint respawn point was being constructed twice, redundantly.** The scaffold built a temporary `CheckpointManager` inside `setupCheckpoints()` (seeded 0,0, then reseeded again if it found the order-0 object while looping), then immediately discarded and rebuilt it in `create()` from the player-spawn object. Consolidated to a single construction in `create()`, computed once from `playerSpawn` (falling back to the order-0 checkpoint object, then a hardcoded default) before `setupCheckpoints()` ever runs; that method now only wires the touch-zone overlaps.

- **Enemy roster reuse for the mid-boss, per GDD §3.1's explicit intent.** "Twin patrol drones circling a pylon" is the same Patrol Drone enemy type, not a bespoke mid-boss class - `PatrolDrone` takes an optional `orbit: {centerX, centerY, angleOffsetRad}` and switches from velocity-driven back-and-forth patrol to a kinematic `body.reset()`-per-frame circular path around that center. The two orbit drones share one pylon-center lookup (found once, by scanning the entities layer for the `pylon` object) and a 180°-offset starting angle, so they stay perpetually diametrically opposite - verified in isolation (positions always exactly `2 * orbitRadius` apart, every frame).

- **Weakness-hook damage is a hard interrupt; buster damage is not.** `Enemy.takeDamage()` (used by all buster hits) reduces HP and flashes, nothing more - it must not interrupt Volt Cheetah's current pattern, since GDD §4 only promises an interrupt on the (future) weapon weakness hit. `VoltCheetah.takesWeakness(weaponId)` is a separate entry point: fixed 4 damage via the same `takeDamage`, then forces `bossFsmState = 'stunned'` and zeroes velocity/hides the sweep hazard regardless of what pattern was mid-flight. `weaponId` is unused today (no real weapon system exists until a later milestone) but the signature is real and callable now, matching the ask to have the interface "stubbed."

- **Ambiguous GDD case: what happens if the player dies mid-boss-fight, behind the sealed door?** Not specified. The base `respawnPlayer()` sends the player back to the last checkpoint (`checkpoint-preboss`, which sits *outside* the boss room) - fine everywhere else in the stage, but inside a permanently-sealed boss room this would strand the player behind a shutter that never reopens. Resolved in favor of precision game feel, Mega-Man convention: `SpeedwayScene` overrides `respawnPlayer()` to run the base reset (position, all enemies including the boss, HP) and then, only if the boss encounter is already underway, re-lands the player just inside the door instead. The boss itself resets to full HP on this respawn too (a mid-fight death costs the whole attempt, not just a checkpoint crawl-back) - consistent with every other death in the stage.

- **"Weapon-get screen" implemented as an in-scene overlay, not a new registered Scene.** GDD asks for "power-down -> weapon-get screen stub -> return to StageSelect." A full `Phaser.Scene` for a placeholder screen felt like premature structure for content that doesn't exist yet (no weapon system, no weapon-wheel UI until a later milestone) - a full-screen overlay (`rectangle` + `text`, `setScrollFactor(0)`, a few seconds' hold) inside `SpeedwayScene` delivers the same beat (freeze gameplay via a `stageComplete` flag gating `fixedUpdate`, show the stub, then `scene.start('StageSelect')`) with far less surface area to redo once the real weapon-get flow is designed.

- **Stage Select now offers two destinations instead of "tap anywhere -> Gym."** With a real stage to route to, the single full-screen tap target from M0/M1 no longer made sense - replaced with two labeled buttons ("SPEEDWAY SAVANNA" / "PLAYER GYM (practice)") so the Gym stays reachable as a controller practice space rather than being orphaned by the new stage.

## M1 — Player Controller + Touch Input

- **Touch cluster repositioning (post-merge tuning, real-device feedback).** The original layout
  anchored the right button cluster (A/B/C + weapon-swap) and the fixed-D-pad mode a small fixed
  dp offset from the screen edges (e.g. Jump at 44dp from the right, 40dp from the bottom) - on a
  real phone this landed in the physical corner, causing thumb strain. Reworked both clusters to
  anchor from a percentage of the play area's width/height instead of fixed dp
  (`touchLayout.leftCluster` / `rightCluster`, ~13.5% in from the side edge, ~32.5% up from the
  bottom - within the requested 12-15%/30-35% range), computed against the actual rendered canvas
  width (`this.scale.width`, which already varies 320-420px with device aspect per the M0
  extend-background fix) rather than the narrower fixed-320px gameplay-critical frame - a thumb
  reaches based on where the physical screen edges are, not an abstract inner frame. The
  within-cluster arrangement (A/B/C triangle spacing, weapon-swap arrow positions, button
  diameters) is unchanged - each button is still a fixed dp offset, just now measured from the
  cluster's new percentage-anchored reference point instead of from the raw screen edge, so
  relative ergonomics inside a cluster are preserved while the cluster as a whole moved inward.
  Verified visually at 16:9, the S25's 19.5:9, and 21:9 - both clusters land at a consistent,
  comfortable inset at every ratio instead of drifting toward the corner as the canvas widens.
  Safe-area-inset handling needed no new code: `index.html`'s `env(safe-area-inset-*)` padding on
  the `#app` container (M0) already keeps the entire canvas off the notch/gesture bar before any
  in-game coordinate is computed, so nothing rendered inside the canvas - these clusters included
  - can ever land under a notch or the gesture bar.

- **Two parallel fixed-step clocks, on purpose.** Arcade Physics already runs its own internal
  fixed-60Hz accumulator when `physics.arcade.fps: 60` is set (confirmed by reading
  `node_modules/phaser/src/physics/arcade/World.js` - it's the same "accumulate delta, step while
  >= frame time" pattern as `FixedTimestepAccumulator`). Rather than fight Phaser to route physics
  through my own accumulator, `Player.fixedUpdate` (driven by `BaseScene`'s accumulator, per M0)
  sets velocity/state each fixed step and lets Arcade's own stepping integrate position. Because
  both accumulators consume the exact same per-frame `delta` and use the same threshold, they step
  the same number of times per render frame - no drift between the two. The one real cost: physics
  steps in Phaser's `UPDATE` phase, before `BaseScene.update()` (my `fixedUpdate`) runs, so a
  velocity change decided this step is only applied on the *next* physics step - a constant ~1
  fixed-frame (16.7ms) of extra input latency, deemed acceptable (well under human reaction-time
  thresholds) versus the risk of hand-rolling manual Arcade World stepping.

- **P1-class bug found while wiring render interpolation for the player: `InterpolatedPhysicsSprite`.**
  The naive plan (write `renderAlpha`-interpolated positions straight onto the physics sprite each
  render frame, like M0's non-physics "pacer" demo) is unsound for a real Arcade body:
  `Body.preUpdate()` calls `updateFromGameObject()` **every render frame, unconditionally** - it
  re-reads the GameObject's x/y as the new authoritative simulation position, before deciding
  whether a step happens. Writing an interpolated (non-integer-step) position to the physics
  sprite would get read back in as real simulation state on the very next frame, corrupting
  position tracking. Fixed with `src/actors/InterpolatedPhysicsSprite.ts`: the physics-driving
  sprite (`Player`, `MovingPlatform`) stays invisible and only drives collision; a separate
  plain `visual` sprite (no body, so no feedback path) is what's actually rendered, positioned via
  `PositionInterpolator` each frame. `TargetDummy` doesn't need this - it never moves.

- **Gravity / tile size / derived jump velocities.** The GDD gives jump height in tiles (min 2,
  max 3.5) but not a tile size or gravity value. Set `TILE_SIZE = 16` (matches the GDD's own 16x16
  tileset spec, §10.5) and `gravity = 900px/s²` (chosen for a ~21-frame rise to apex on a max
  jump - a snappy, Mega-Man-scaled arc). `computeJumpVelocities()` derives the launch/cut
  velocities from those so the *tunable* surface for the PO stays the height-in-tiles values in
  `playerTuning.ts`, not raw velocities.

- **Wall-kick shaft found to be a soft-lock, not an optional test feature - fixed.** As first
  built, the wall-kick shaft's walls ran floor-to-ceiling directly across the main ground path,
  with no way around at ground level and no way past without successfully chaining wall-kicks to
  the top. Caught this by scripting a bot to just walk right through the gym without climbing it -
  it got stuck. A real player who can't execute the kick chain would be stuck too, which fails the
  "fast retry" pillar hard. Repositioned the shaft above the stairs' top platform (walls stop at
  the stairs' height, not `GROUND_TOP`) so it's now a genuine optional detour: the main ground path
  is unobstructed underneath for anyone who skips it, and it's still fully climbable/testable via
  wall-kicks for anyone who takes it.

- **Buster projectile despawn bug found and fixed.** Projectiles originally deactivated when
  `this.x` (world position) exceeded `scene.scale.width` (the ~320-420px logical *viewport*
  width) - correct for a single-screen scene, wrong for the Gym's ~1400px scrollable level: once
  the camera scrolled past the first screen, every shot fired anywhere in the level was instantly
  treated as "off-screen" and despawned, so the buster appeared to do nothing against the target
  dummy. Found via a direct-state Playwright check (shots showed `active:false` immediately after
  firing, far from the pool being exhausted). Fixed with a flight-time-based despawn
  (`playerTuning.buster.maxFlightMs`) instead of a position/viewport check - correct regardless of
  world size, and the more standard pattern for pooled projectiles anyway.

- **Knockback and hitstun numbers.** "4px hop away from damage source" is implemented as a literal
  4px instant repositioning (via `body.reset`, not a velocity impulse - guarantees an exact,
  deterministic 4px regardless of frame rate) plus a small upward velocity so it visually reads as
  a hop. Added a `hitstunFrames` (10) lockout during which the player can't act, distinct from the
  GDD's boss-weakness *hitstop* (freeze-frame, an M8 polish-pass item per the M8 prompt, not built
  here) - hitstun is "you got hit and briefly can't cancel it," which the GDD's knockback line
  implies but doesn't name a duration for.

- **Manual pause vs. physics.** `BaseScene`'s manual-pause flag (M0) only ever skipped
  `fixedUpdate`; it never needed to touch Arcade's own stepping. Confirmed still correct with real
  physics bodies in the mix - Arcade World simply doesn't get new velocity commands while paused
  and nothing drifts, since nothing this scene mutates positions outside `fixedUpdate`.

- **48dp touch targets on a variable-zoom canvas.** "dp" (density-independent px) is equivalent to
  CSS px, but our logical canvas is scaled to the screen by an integer zoom that's computed per
  device (M0). A touch button authored as a fixed *logical* px size could measure well under 48
  CSS px on a high-density/low-zoom device. `src/systems/touchScale.ts` converts
  `dp -> logical px` via `scene.scale.displayScale.x` (logical-px-per-CSS-px) at construction
  time, so buttons are guaranteed >=48 CSS px on any device regardless of the zoom Phaser picked.

- **Hold-B auto-fire, literally.** Read the GDD's "Hold-B auto-fire toggle... for players who
  dislike tap-mashing" (§2.2b) as: holding Shoot repeatedly fires uncharged shots at a fixed
  interval instead of charging - an alternate firing mode traded off against the charge mechanic,
  not an addition to it. Wired as `touchLayout.autoFire.enabledDefault` (off by default, matching
  hold-to-charge as the primary/expected behavior); a real settings-menu toggle is M5 scope.

- **Floating stick vs. fixed D-pad: both fully built, switched at build time.** The GDD asks for
  "player choice" but there's no settings menu yet to offer that choice at runtime (M5). Both
  `FloatingStick` and `FixedDpad` are complete, functional implementations behind
  `touchLayout.stickMode`; wiring an in-game toggle is pure plumbing once M5's settings UI exists,
  not a redesign.

- **Debug overlay's "touch zones" requirement.** Not drawn as a separate overlay layer - the
  on-screen buttons/stick are already rendered as translucent shapes at their exact interactive
  bounds at all times (not just in debug mode), so they already are their own zone visualization.
  Adding a redundant outline layer under F3 would just duplicate what's already always visible.

- **Scene rename: `Stage` -> `Gym`.** M0's `StageScene` (a bouncing-rectangle demo of the
  fixed-timestep/interpolation wiring) is deleted; its sole purpose is now demonstrated for real by
  the Player controller in the new `GymScene`. `StageSelectScene` now routes to `Gym`. `Stage` is
  reserved for M2's real first level (Speedway Savanna) so the naming doesn't collide later.

- **Real device / environment limits on what could be verified here.** No Android SDK in this
  sandbox (same limitation as M0/M0-fix) - couldn't build or install the actual debug APK; CI will
  produce it. Extensively playtested the web build headlessly (movement, variable jump height,
  coyote/buffer, wall-slide, wall-kick, all three gap sizes, stairs, spikes, the moving platform
  and its fall-through/respawn safety net, buster charging and damage against the target dummy,
  the floating stick via mouse-drag, and manual pause) with zero console errors throughout.
  Genuine **true multi-touch (3+ simultaneous physical touches, and the three-finger debug-toggle
  gesture) could not be exercised** in this headless environment - Chromium's synthetic
  `TouchEvent` dispatch didn't register with Phaser's input plugin in testing here, and
  Playwright's touchscreen API is single-point. The multi-touch *architecture* (per-pointer-id
  tracking in `TouchButton`/`FloatingStick`, `activePointers: 4` in the game config, the merge
  logic in `InputManager`) is verified by code review and unit tests, and single-pointer
  interaction (buttons, drag) is confirmed working end-to-end, but simultaneous multi-finger input
  and the three-finger gesture specifically need a real-device pass.

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
